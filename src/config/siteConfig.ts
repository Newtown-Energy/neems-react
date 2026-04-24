// Per-site configuration toggles.
//
// For the SLD feedback round (Phase 1) these live as hardcoded constants.
// Phase 2 will wrap this in a `useSiteConfig()` hook with the same shape so
// that a later effort can swap in a DB-backed source without touching
// consumers. Keep the surface narrow and strongly typed.

import type { AlarmSeverityDto } from '@newtown-energy/types';

export interface SiteConfig {
  sld: {
    /** Render the 52-M1 main breaker on the SLD. */
    showMainBreaker52M1: boolean;
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

export const SITE_CONFIG: SiteConfig = {
  sld: {
    showMainBreaker52M1: true,
    showLockoutRelay: true,
  },
  lockout: {
    remoteTriggerEnabled: false,
  },
  alarmLevelOverrides: {},
};

/**
 * Apply any configured severity override for a given alarm. Returns the
 * original severity if no override is set.
 */
export function resolveAlarmSeverity(
  alarmNum: number,
  severity: AlarmSeverityDto,
): AlarmSeverityDto {
  return SITE_CONFIG.alarmLevelOverrides[alarmNum] ?? severity;
}
