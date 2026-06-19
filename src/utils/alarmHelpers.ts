import type { AlarmSeverityDto, AlarmZoneDto } from '@newtown-energy/types';

export const ZONE_DISPLAY_NAMES: Record<AlarmZoneDto, string> = {
  Site: 'Site',
  BreakerRelay: 'Breaker Relay (SEL-451)',
  Meter: 'Meter (SEL-735)',
  Transformer1: 'Transformer 1',
  Transformer2: 'Transformer 2',
  Rtac: 'RTAC',
  Facp: 'Fire Alarm Panel',
  TeslaSiteController: 'Tesla Site Controller',
  Mp1a: 'Megapack 1A',
  Mp1b: 'Megapack 1B',
  Mp1c: 'Megapack 1C',
  Mp2a: 'Megapack 2A',
  Mp2b: 'Megapack 2B',
  Mp2c: 'Megapack 2C',
};

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

export function getZoneCategory(zone: AlarmZoneDto): AlarmCategory {
  switch (zone) {
    case 'Facp':
      return 'Fire';
    case 'BreakerRelay':
    case 'Meter':
    case 'Transformer1':
    case 'Transformer2':
      return 'Electrical';
    case 'Mp1a':
    case 'Mp1b':
    case 'Mp1c':
    case 'Mp2a':
    case 'Mp2b':
    case 'Mp2c':
    case 'TeslaSiteController':
      return 'Battery';
    case 'Site':
    case 'Rtac':
      return 'Control';
  }
}
