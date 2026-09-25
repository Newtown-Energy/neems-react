// Per-site configuration toggles.
//
// Each site design supplies its own (see `src/designs/<id>/config.ts`); these
// accessors read the session's design. Keep the surface narrow and strongly
// typed.

import type { AlarmSeverityDto } from '@newtown-energy/types';
import { activeDesign } from '../designs/active';
import { useSiteDesign } from '../designs/context';

export interface SiteConfig {
  sld: {
    /** Render the lockout relay on the SLD (off the SEL-451). */
    showLockoutRelay: boolean;
  };
  lockout: {
    /** Whether the lockout relay may be triggered from the UI. */
    remoteTriggerEnabled: boolean;
  };
  /**
   * Override the severity of specific alarms by alarm_num. Applied anywhere
   * severity is rendered (SLD alarm shapes, Alarms page table).
   */
  alarmLevelOverrides: Record<number, AlarmSeverityDto>;
}

/**
 * Apply any configured severity override for a given alarm. Returns the
 * original severity if no override is set.
 *
 * Reads the session's design directly rather than through a hook, because the
 * diagram reducer and page-level sorting call it outside any component.
 */
export function resolveAlarmSeverity(
  alarmNum: number,
  severity: AlarmSeverityDto,
): AlarmSeverityDto {
  return activeDesign().config.alarmLevelOverrides[alarmNum] ?? severity;
}

/** The session's per-site configuration. */
export function useSiteConfig(): SiteConfig {
  return useSiteDesign().config;
}
