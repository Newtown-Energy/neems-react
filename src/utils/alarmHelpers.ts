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

/** Get MUI color for alarm severity */
export function getSeverityColor(
  severity: AlarmSeverityDto,
): 'error' | 'warning' | 'info' | 'success' {
  switch (severity) {
    case 'Emergency':
      return 'error';
    case 'Critical':
      return 'warning';
    case 'Warning':
      return 'info';
    case 'Info':
      return 'success';
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
