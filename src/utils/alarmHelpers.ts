import type { AlarmSeverityDto, AlarmZoneDto } from '@newtown-energy/types';
import { activeDesign } from '../designs/active';

/**
 * How a zone is named to an operator, in the session's site design. The zone
 * set itself comes from the backend; only the names are per design.
 */
export function zoneDisplayName(zone: AlarmZoneDto): string {
  return activeDesign().alarms.zoneDisplayNames[zone];
}

/** Every zone the session's site design names, for filters and pickers. */
export function zoneDisplayNames(): Readonly<Record<AlarmZoneDto, string>> {
  return activeDesign().alarms.zoneDisplayNames;
}

/** Convert snake_case alarm name to Title Case */
export function formatAlarmName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * MUI Chip `color` for an alarm severity. Returns custom theme palette colors
 * (registered in `theme.ts`) so severity Chips match the SLD palette exactly:
 *   Emergency → red, Critical → orange, Warning → yellow, Info → blue.
 * These resolve to the same hexes as `severityColor()` used for SLD visuals.
 */
export function getSeverityColor(
  severity: AlarmSeverityDto,
): 'severityEmergency' | 'severityCritical' | 'severityWarning' | 'severityInfo' {
  switch (severity) {
    case 'Emergency':
      return 'severityEmergency';
    case 'Critical':
      return 'severityCritical';
    case 'Warning':
      return 'severityWarning';
    case 'Info':
      return 'severityInfo';
  }
}

/** Get sort order for severity (lower = more severe) */
export function getSeverityOrder(severity: AlarmSeverityDto): number {
  switch (severity) {
    case 'Emergency':
      return 0;
    case 'Critical':
      return 1;
    case 'Warning':
      return 2;
    case 'Info':
      return 3;
  }
}

/**
 * Higher-level category grouping for the FDNY / Alarms page. The
 * underlying [AlarmZoneDto] is a physical system; categories group those
 * systems into the operator-facing buckets the demo script asks for
 * (electrical / fire / battery / control).
 */
export type AlarmCategory = 'Fire' | 'Electrical' | 'Battery' | 'Control';

export const ALARM_CATEGORY_ORDER: AlarmCategory[] = [
  'Fire',
  'Electrical',
  'Battery',
  'Control'
];

/** The operator-facing bucket a zone belongs to, in the session's site design. */
export function getZoneCategory(zone: AlarmZoneDto): AlarmCategory {
  return activeDesign().alarms.zoneCategories[zone];
}
