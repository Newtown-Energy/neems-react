/**
 * Schedule warning engine.
 *
 * Two pure evaluators live here:
 *
 *   - [evaluateCommandWarnings] looks at *schedule shape* — properties
 *     of the future [ScheduleCommandDto] itself (off-peak / peak-revenue
 *     window fit, charging direction vs. variant, interconnection cap).
 *     These are stable predictions about a planned command and render
 *     inline in the edit dialogs.
 *
 *   - [evaluateSiteState] looks at *current operational state* — open
 *     breakers, offline Megapacks, utility curtailment, low SoC. These
 *     don't tell you anything about whether a 4pm discharge tomorrow
 *     is well-formed; by 4pm tomorrow the breaker may have closed and
 *     SoC may have replenished. They're "is the site OK right now"
 *     facts and belong on the SLD page + an app-wide indicator, not
 *     in the schedule editor.
 *
 * Both evaluators are pure — they don't import the demo-overrides
 * context directly. Callers read context state and pass it in, so this
 * module stays trivially testable under Bun.
 */

import type { ScheduleCommandDto, Site } from '@newtown-energy/types';

export type WarningSeverity = 'info' | 'warning' | 'error';

export interface ScheduleWarning {
  /** Stable identifier — used to dedupe and (when [dismissible]) to
   *  remember dismissals across reloads. */
  key: string;
  severity: WarningSeverity;
  message: string;
  /** Whether the user is allowed to silence this permanently. Hard
   *  safety warnings (variant mismatch, interconnection breach) stay
   *  un-dismissible. */
  dismissible: boolean;
  /** When set, the user's "Never show again" choice for this key is
   *  written to `localStorage`. */
  dismissKey?: string;
}

/**
 * Optional context for [evaluateCommandWarnings]. Reserved for future
 * window-vs-now checks (e.g. "this command is in the past from the
 * operator's forced clock"). The live-state fields that used to live
 * here have moved to [SiteStateContext] because they describe the
 * site, not the future shape of a command.
 */
export interface ScheduleWarningContext {
  /** Operator-forced "now" — currently unused by the engine; kept so
   *  future shape-of-command checks can plug in without breaking the
   *  callsite signature. */
  forcedNow?: Date | null;
}

/**
 * Live state used by [evaluateSiteState]. Populated by the demo
 * overrides drawer; in production it would be derived from real
 * telemetry (breaker positions, Megapack availability, utility
 * curtailment, SoC).
 */
export interface SiteStateContext {
  /** Current SoC, 0–100. Below [LOW_SOC_THRESHOLD_PERCENT] flags. */
  currentSocPercent?: number | null;
  /** Utility curtailment ceiling in kW. Any non-null value below the
   *  site's [power_kw] flags. */
  curtailmentCeilingKw?: number | null;
  /** Breakers currently open. Any non-empty list flags. */
  openBreakers?: string[];
  /** Megapacks currently offline. Any non-empty list flags. */
  offlineMegapacks?: string[];
}

/** A single site-state row — what the top-bar indicator and the SLD
 *  panel render. */
export interface SiteStateIssue {
  /** Stable identifier — used to key React lists. */
  key: string;
  severity: WarningSeverity;
  message: string;
}

/**
 * SoC at or below this threshold (percent) flags as a site-state
 * issue. Chosen so the demo's "set SoC to 10%" lights up the banner
 * without firing on a routine mid-charge reading.
 */
export const LOW_SOC_THRESHOLD_PERCENT = 20;

const DISMISS_STORAGE_KEY = 'neems.scheduleWarnings.dismissed';

function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function writeDismissed(set: Set<string>): void {
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // localStorage may be disabled (Safari private mode); silently
    // fall back to in-memory dismissal for this session.
  }
}

/** Permanently silence a warning [dismissKey] across reloads. */
export function dismissWarningPermanently(dismissKey: string): void {
  const set = readDismissed();
  set.add(dismissKey);
  writeDismissed(set);
}

/** Restore a previously-silenced warning. Exposed for tests and a
 *  future "reset warnings" affordance in the UI. */
export function undismissWarning(dismissKey: string): void {
  const set = readDismissed();
  set.delete(dismissKey);
  writeDismissed(set);
}

/** Drop *all* "never show again" dismissals. Backs the Reset button on
 *  the Site Defaults panel. */
export function clearAllDismissedWarnings(): void {
  try {
    localStorage.removeItem(DISMISS_STORAGE_KEY);
  } catch {
    // see writeDismissed — silent fallback
  }
}

/** Read the count of currently-persisted dismissals. Used by the UI to
 *  decide whether to surface the reset affordance. */
export function getDismissedWarningCount(): number {
  return readDismissed().size;
}

/** Strip warnings the user has asked to never see again. */
export function filterDismissedWarnings(warnings: ScheduleWarning[]): ScheduleWarning[] {
  const dismissed = readDismissed();
  return warnings.filter(w => !w.dismissKey || !dismissed.has(w.dismissKey));
}

function timeOfDayInWindow(
  offsetSeconds: number,
  startMinutes: number | null | undefined,
  endMinutes: number | null | undefined
): boolean {
  if (startMinutes === null || startMinutes === undefined) return true;
  if (endMinutes === null || endMinutes === undefined) return true;
  const offsetMinutes = Math.floor(offsetSeconds / 60);
  // Windows are stored as [start, end) in minutes-since-midnight. We
  // support wrap-around (e.g. 22:00 → 06:00) by checking the disjoint
  // case explicitly.
  if (startMinutes <= endMinutes) {
    return offsetMinutes >= startMinutes && offsetMinutes < endMinutes;
  }
  return offsetMinutes >= startMinutes || offsetMinutes < endMinutes;
}

/**
 * Evaluate the schedule-shape warnings for a single command. Returns
 * warnings in display order (hard errors first, then dismissible
 * window-fit warnings, then interconnection-cap math).
 *
 * Site-state issues (breakers, megapacks, curtailment, SoC) are NOT
 * evaluated here — see [evaluateSiteState].
 */
export function evaluateCommandWarnings(
  command: ScheduleCommandDto,
  site: Site,
  _context: ScheduleWarningContext = {}
): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];

  // --- Hard safety warning (never dismissible) -------------------------

  if (site.site_variant === 'no_grid_charge' && command.command_type !== 'discharge') {
    warnings.push({
      key: `${command.id}:variant-no-grid-charge`,
      severity: 'error',
      message: 'Inverters at this site cannot charge from the grid — remove this command or switch the variant.',
      dismissible: false
    });
  }

  // --- Soft window-fit warnings ----------------------------------------

  const offset = command.execution_offset_seconds;
  const inOffPeak = timeOfDayInWindow(
    offset,
    site.off_peak_start_minutes,
    site.off_peak_end_minutes
  );
  const inPeakRevenue = timeOfDayInWindow(
    offset,
    site.peak_revenue_start_minutes,
    site.peak_revenue_end_minutes
  );

  const hasOffPeakWindow =
    site.off_peak_start_minutes !== null && site.off_peak_end_minutes !== null;
  const hasPeakRevenueWindow =
    site.peak_revenue_start_minutes !== null && site.peak_revenue_end_minutes !== null;

  if (command.command_type === 'discharge' && hasPeakRevenueWindow && !inPeakRevenue) {
    warnings.push({
      key: `${command.id}:discharge-outside-peak-revenue`,
      severity: 'warning',
      message: 'Discharge scheduled outside the peak-revenue window — revenue per kWh will be lower.',
      dismissible: true,
      dismissKey: 'schedule.discharge-outside-peak-revenue'
    });
  }

  if (command.command_type === 'discharge' && hasOffPeakWindow && inOffPeak) {
    warnings.push({
      key: `${command.id}:discharge-inside-off-peak`,
      severity: 'warning',
      message: 'Discharge scheduled inside the off-peak charging window — this fights the charging plan.',
      dismissible: true,
      dismissKey: 'schedule.discharge-inside-off-peak'
    });
  }

  if (
    (command.command_type === 'charge' || command.command_type === 'trickle_charge') &&
    hasOffPeakWindow &&
    !inOffPeak
  ) {
    warnings.push({
      key: `${command.id}:charge-outside-off-peak`,
      severity: 'warning',
      message: 'Charging scheduled outside the off-peak window — energy costs will be higher.',
      dismissible: true,
      dismissKey: 'schedule.charge-outside-off-peak'
    });
  }

  // --- Interconnection cap (static site property) ---------------------

  if (
    command.command_type === 'discharge' &&
    site.interconnection_max_output_kw !== null &&
    site.power_kw !== null &&
    site.power_kw > site.interconnection_max_output_kw
  ) {
    warnings.push({
      key: `${command.id}:interconnection-cap`,
      severity: 'warning',
      message: `Site power (${site.power_kw} kW) exceeds the interconnection cap (${site.interconnection_max_output_kw} kW). Discharge will be clamped.`,
      dismissible: false
    });
  }

  return warnings;
}

/**
 * Evaluate site-state issues — things that describe the operational
 * state of the site *right now*, not the shape of a planned command.
 * Renders in the app-wide indicator and on the SLD page.
 */
export function evaluateSiteState(
  site: Site,
  context: SiteStateContext = {}
): SiteStateIssue[] {
  const issues: SiteStateIssue[] = [];

  if (context.openBreakers && context.openBreakers.length > 0) {
    issues.push({
      key: 'open-breakers',
      severity: 'error',
      message: `Breaker${context.openBreakers.length === 1 ? '' : 's'} open: ${context.openBreakers.join(', ')}. Commands will not execute.`
    });
  }

  if (context.offlineMegapacks && context.offlineMegapacks.length > 0) {
    issues.push({
      key: 'megapack-offline',
      severity: 'warning',
      message: `Megapack${context.offlineMegapacks.length === 1 ? '' : 's'} offline: ${context.offlineMegapacks.join(', ')}. Available power is reduced.`
    });
  }

  if (
    typeof context.curtailmentCeilingKw === 'number' &&
    site.power_kw !== null &&
    context.curtailmentCeilingKw < site.power_kw
  ) {
    issues.push({
      key: 'curtailment-active',
      severity: 'warning',
      message: `Utility curtailment active: output capped at ${context.curtailmentCeilingKw} kW (site power ${site.power_kw} kW).`
    });
  }

  if (
    typeof context.currentSocPercent === 'number' &&
    context.currentSocPercent <= LOW_SOC_THRESHOLD_PERCENT
  ) {
    const severity: WarningSeverity =
      context.currentSocPercent <= site.rebound_protection_soc_floor_percent
        ? 'error'
        : 'warning';
    issues.push({
      key: 'low-soc',
      severity,
      message: `Battery state of charge low: ${context.currentSocPercent}% (rebound floor ${site.rebound_protection_soc_floor_percent}%).`
    });
  }

  return issues;
}
