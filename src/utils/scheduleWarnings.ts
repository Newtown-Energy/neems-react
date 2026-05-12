/**
 * Schedule warning engine.
 *
 * Evaluates a [ScheduleCommandDto] against a [Site]'s configured
 * windows and an optional "live" context (breaker states, Megapack
 * availability, utility curtailment ceiling, current SoC) to produce a
 * list of [ScheduleWarning] rows. The edit dialogs render those rows
 * as an [Alert] stack; the user can dismiss any warning, and warnings
 * with a [dismissKey] can be silenced permanently via `localStorage`.
 *
 * The context state lives in `sessionStorage` (set by the demo-time
 * controls drawer in F8) so warnings change as you flip the live state
 * during the demo. We don't import that drawer here — callers pass the
 * already-read context — so this module stays pure.
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
 * Live state that affects warnings but is not part of the command or
 * the site row. All fields are optional — F8 will populate them via
 * the demo overrides drawer. When omitted, the corresponding warnings
 * simply aren't evaluated.
 */
export interface ScheduleWarningContext {
  /** Operator-forced "now" (used to compare against site windows). */
  forcedNow?: Date | null;
  /** Current SoC, 0–100. Used for the discharge-runtime warning when
   *  the command has a [duration_seconds] set. */
  currentSocPercent?: number | null;
  /** Utility curtailment ceiling in kW. Discharge commands that exceed
   *  this raise a warning. */
  curtailmentCeilingKw?: number | null;
  /** Per-breaker state map keyed by breaker name. Truthy means open
   *  (which is unsafe for any command). */
  openBreakers?: string[];
  /** Per-Megapack offline state map keyed by device name. */
  offlineMegapacks?: string[];
}

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

function formatMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) {
    return `${Math.round(totalMinutes)} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  return mins === 0 ? `${hours} h` : `${hours} h ${mins} min`;
}

/**
 * Evaluate the warnings for a single command. Returns warnings in the
 * order callers should display them (hard errors first, then soft
 * "schedule shape" warnings, then SoC math). Pass a partial [context]
 * to opt into the live-state warnings.
 */
export function evaluateCommandWarnings(
  command: ScheduleCommandDto,
  site: Site,
  context: ScheduleWarningContext = {}
): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];

  // --- Hard safety warnings (never dismissible) -------------------------

  if (site.site_variant === 'no_grid_charge' && command.command_type !== 'discharge') {
    warnings.push({
      key: `${command.id}:variant-no-grid-charge`,
      severity: 'error',
      message: 'Inverters at this site cannot charge from the grid — remove this command or switch the variant.',
      dismissible: false
    });
  }

  if (context.openBreakers && context.openBreakers.length > 0) {
    warnings.push({
      key: `${command.id}:open-breakers`,
      severity: 'error',
      message: `Breaker${context.openBreakers.length === 1 ? '' : 's'} currently open: ${context.openBreakers.join(', ')}. Command will not execute.`,
      dismissible: false
    });
  }

  if (context.offlineMegapacks && context.offlineMegapacks.length > 0) {
    warnings.push({
      key: `${command.id}:megapack-offline`,
      severity: 'warning',
      message: `Megapack${context.offlineMegapacks.length === 1 ? '' : 's'} offline: ${context.offlineMegapacks.join(', ')}. Available power is reduced.`,
      dismissible: false
    });
  }

  // --- Soft "schedule shape" warnings ----------------------------------

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

  // --- Capacity / curtailment / runtime math ---------------------------

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

  if (
    command.command_type === 'discharge' &&
    typeof context.curtailmentCeilingKw === 'number' &&
    site.power_kw !== null &&
    site.power_kw > context.curtailmentCeilingKw
  ) {
    warnings.push({
      key: `${command.id}:curtailment-ceiling`,
      severity: 'warning',
      message: `Utility curtailment is active at ${context.curtailmentCeilingKw} kW. Output will be capped.`,
      dismissible: false
    });
  }

  if (
    command.command_type === 'discharge' &&
    command.duration_seconds !== null &&
    command.duration_seconds !== undefined &&
    site.capacity_kwh !== null &&
    site.power_kw !== null &&
    site.power_kw > 0
  ) {
    const startingSoc = context.currentSocPercent ?? 100;
    const floor = site.rebound_protection_soc_floor_percent ?? 0;
    const usableSoc = Math.max(0, startingSoc - floor);
    const usableKwh = (usableSoc / 100) * site.capacity_kwh;
    const availableMinutes = (usableKwh / site.power_kw) * 60;
    const requestedMinutes = command.duration_seconds / 60;
    if (requestedMinutes > availableMinutes + 0.5) {
      warnings.push({
        key: `${command.id}:soc-shortfall`,
        severity: 'warning',
        message:
          `From ${startingSoc.toFixed(0)}% SoC down to the ${floor.toFixed(0)}% floor, this site sustains only ${formatMinutes(availableMinutes)} at ${site.power_kw} kW — ${formatMinutes(requestedMinutes)} requested.`,
        dismissible: false
      });
    }
  }

  return warnings;
}
