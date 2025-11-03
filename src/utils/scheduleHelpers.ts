/**
 * Schedule Helper Utilities
 *
 * Helper functions for working with schedule templates and entries,
 * including time conversion and validation.
 */

import type { MockScheduleTemplateEntry } from './mockScheduleApi';

export type CommandType = 'charge' | 'discharge' | 'trickle_charge';

/**
 * Convert seconds offset to HH:MM string format
 *
 * @param seconds - Seconds offset from midnight (0-86399)
 * @returns Time string in HH:MM format
 *
 * @example
 * secondsToTime(0)      // "00:00"
 * secondsToTime(3600)   // "01:00"
 * secondsToTime(28800)  // "08:00"
 * secondsToTime(57600)  // "16:00"
 */
export function secondsToTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Convert hour and minute to seconds offset from midnight
 *
 * @param hour - Hour (0-23)
 * @param minute - Minute (0-59)
 * @returns Seconds offset from midnight
 *
 * @example
 * timeToSeconds(0, 0)   // 0
 * timeToSeconds(1, 0)   // 3600
 * timeToSeconds(8, 30)  // 30600
 * timeToSeconds(16, 45) // 60300
 */
export function timeToSeconds(hour: number, minute: number): number {
  return hour * 3600 + minute * 60;
}

/**
 * Parse HH:MM time string to hour and minute
 *
 * @param timeString - Time in HH:MM format
 * @returns Object with hour and minute
 *
 * @example
 * parseTimeString("08:30") // { hour: 8, minute: 30 }
 */
export function parseTimeString(timeString: string): { hour: number; minute: number } {
  const [hourStr, minuteStr] = timeString.split(':');
  return {
    hour: parseInt(hourStr, 10),
    minute: parseInt(minuteStr, 10)
  };
}

/**
 * Check if a time conflicts with existing entries
 *
 * @param entries - Existing schedule entries
 * @param offsetSeconds - Time offset to check
 * @param excludeId - Optional entry ID to exclude from check (for editing)
 * @returns true if conflict exists, false otherwise
 */
export function hasTimeConflict(
  entries: MockScheduleTemplateEntry[],
  offsetSeconds: number,
  excludeId?: number
): boolean {
  return entries.some(
    entry => entry.id !== excludeId && entry.execution_offset_seconds === offsetSeconds
  );
}

/**
 * Validate that a time is within 24 hours (0-86399 seconds)
 *
 * @param offsetSeconds - Time offset to validate
 * @returns true if valid, false otherwise
 */
export function isValidTimeOffset(offsetSeconds: number): boolean {
  return offsetSeconds >= 0 && offsetSeconds < 86400;
}

/**
 * Get display label for command type
 *
 * @param type - Command type
 * @returns Human-readable label
 */
export function getCommandTypeLabel(type: CommandType): string {
  const labels: Record<CommandType, string> = {
    charge: 'Charge',
    discharge: 'Discharge',
    trickle_charge: 'Trickle Charge'
  };
  return labels[type] || type;
}

/**
 * Get Material-UI color for command type chip
 *
 * @param type - Command type
 * @returns MUI color name
 */
export function getCommandTypeColor(type: CommandType): 'success' | 'warning' | 'info' | 'default' {
  const colors: Record<CommandType, 'success' | 'warning' | 'info'> = {
    charge: 'success',      // green
    discharge: 'warning',   // orange
    trickle_charge: 'info'  // blue
  };
  return colors[type] || 'default';
}

/**
 * Validate hour value (0-23)
 */
export function isValidHour(hour: number): boolean {
  return Number.isInteger(hour) && hour >= 0 && hour <= 23;
}

/**
 * Validate minute value (0-59)
 */
export function isValidMinute(minute: number): boolean {
  return Number.isInteger(minute) && minute >= 0 && minute <= 59;
}

/**
 * Get all available command types
 */
export function getCommandTypes(): CommandType[] {
  return ['charge', 'discharge', 'trickle_charge'];
}
