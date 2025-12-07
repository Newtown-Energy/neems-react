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

/**
 * Format Date to ISO date string (YYYY-MM-DD)
 *
 * @param date - Date object
 * @returns ISO date string
 *
 * @example
 * toISODateString(new Date(2025, 0, 15)) // "2025-01-15"
 */
export function toISODateString(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse ISO date string to Date object
 *
 * @param dateString - ISO date string (YYYY-MM-DD)
 * @returns Date object
 *
 * @example
 * parseISODate("2025-01-15") // Date object for Jan 15, 2025
 */
export function parseISODate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
  return new Date(year, month - 1, day);
}

/**
 * Format date for display
 *
 * @param date - Date object
 * @returns Formatted date string
 *
 * @example
 * formatScheduleDate(new Date(2025, 0, 15)) // "January 15, 2025"
 */
export function formatScheduleDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Check if a date is in the past (before today)
 *
 * @param date - Date to check
 * @returns true if date is before today
 */
export function isPastDate(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate < today;
}

/**
 * Check if a date is today
 *
 * @param date - Date to check
 * @returns true if date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * Add days to a date
 *
 * @param date - Starting date
 * @param days - Number of days to add (can be negative)
 * @returns New date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ============================================================================
// NEW: Application Rule Helper Functions
// ============================================================================

export type RuleType = 'default' | 'day_of_week' | 'specific_date';

/**
 * Get display label for rule type
 */
export function getRuleTypeLabel(ruleType: RuleType): string {
  const labels: Record<RuleType, string> = {
    default: 'Universal Default',
    day_of_week: 'Day of Week',
    specific_date: 'Specific Date'
  };
  return labels[ruleType];
}

/**
 * Get icon for rule type (Material-UI icon name)
 */
export function getRuleTypeIcon(ruleType: RuleType): string {
  const icons: Record<RuleType, string> = {
    default: 'Star',
    day_of_week: 'CalendarMonth',
    specific_date: 'PushPin'
  };
  return icons[ruleType];
}

/**
 * Get color for rule type chip
 */
export function getRuleTypeColor(ruleType: RuleType): 'default' | 'primary' | 'secondary' | 'success' {
  const colors: Record<RuleType, 'default' | 'primary' | 'secondary' | 'success'> = {
    default: 'primary',
    day_of_week: 'secondary',
    specific_date: 'success'
  };
  return colors[ruleType];
}

/**
 * Get day of week name
 */
export function getDayName(dayIndex: number, short = false): string {
  const longNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const shortNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return short ? shortNames[dayIndex] : longNames[dayIndex];
}

/**
 * Format days of week array to human-readable string
 * @example [1,2,3,4,5] => "Monday-Friday"
 * @example [0,6] => "Saturday, Sunday"
 * @example [1,3,5] => "Mon, Wed, Fri"
 */
export function formatDaysOfWeek(days: number[]): string {
  if (days.length === 0) return '';

  const sorted = [...days].sort((a, b) => a - b);

  // Check for common patterns
  if (sorted.length === 5 && sorted.every((d, i) => d === i + 1)) {
    return 'Monday-Friday';
  }
  if (sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6) {
    return 'Saturday, Sunday';
  }
  if (sorted.length === 7) {
    return 'Every Day';
  }

  // For other patterns, use short names
  if (sorted.length <= 3) {
    return sorted.map(d => getDayName(d, true)).join(', ');
  }

  // For 4+ non-consecutive days, use short names
  return sorted.map(d => getDayName(d, true)).join(', ');
}

/**
 * Calculate specificity for a rule type
 * Returns 0 (default), 1 (day_of_week), or 2 (specific_date)
 */
export function getRuleSpecificity(ruleType: RuleType): number {
  const specificity: Record<RuleType, number> = {
    default: 0,
    day_of_week: 1,
    specific_date: 2
  };
  return specificity[ruleType];
}

/**
 * Generate a date range (inclusive)
 */
export function getDateRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  // eslint-disable-next-line no-unmodified-loop-condition -- Date objects are mutated in-place via setDate
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Count affected dates for a rule within a date range
 */
export function countAffectedDates(
  ruleType: RuleType,
  daysOfWeek: number[] | null,
  specificDates: string[] | null,
  dateRange: { startDate: Date; endDate: Date }
): number {
  if (ruleType === 'default') {
    // Default applies to all unmatched dates - hard to count without full context
    return -1; // Return -1 to indicate "variable"
  }

  if (ruleType === 'specific_date' && specificDates) {
    // Count how many specific dates fall within range
    const start = new Date(dateRange.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.endDate);
    end.setHours(0, 0, 0, 0);

    return specificDates.filter(dateStr => {
      const date = parseISODate(dateStr);
      return date >= start && date <= end;
    }).length;
  }

  if (ruleType === 'day_of_week' && daysOfWeek) {
    // Count matching days of week in range
    let count = 0;
    const dates = getDateRange(dateRange.startDate, dateRange.endDate);
    for (const date of dates) {
      if (daysOfWeek.includes(date.getDay())) {
        count += 1;
      }
    }
    return count;
  }

  return 0;
}
