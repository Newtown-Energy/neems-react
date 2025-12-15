import { apiRequestWithMapping } from './api';
import type { ScheduleLibraryItem } from '../types/generated/ScheduleLibraryItem';
import type { ApplicationRule } from '../types/generated/ApplicationRule';
import type { CreateLibraryItemRequest } from '../types/generated/CreateLibraryItemRequest';
import type { UpdateLibraryItemRequest } from '../types/generated/UpdateLibraryItemRequest';
import type { CloneLibraryItemRequest } from '../types/generated/CloneLibraryItemRequest';
import type { CreateApplicationRuleRequest } from '../types/generated/CreateApplicationRuleRequest';
import type { EffectiveScheduleResponse } from '../types/generated/EffectiveScheduleResponse';
import type { CalendarDaySchedule } from '../types/generated/CalendarDaySchedule';
import type { CalendarDayScheduleMatches } from '../types/generated/CalendarDayScheduleMatches';

// ============================================================================
// Library Items
// ============================================================================

export async function getLibraryItems(siteId: number): Promise<ScheduleLibraryItem[]> {
  return await apiRequestWithMapping<ScheduleLibraryItem[]>(
    `/api/1/Sites/${siteId}/ScheduleLibraryItems`
  );
}

export async function getLibraryItem(itemId: number): Promise<ScheduleLibraryItem> {
  return await apiRequestWithMapping<ScheduleLibraryItem>(
    `/api/1/ScheduleLibraryItems/${itemId}`
  );
}

export async function createLibraryItem(
  siteId: number,
  request: CreateLibraryItemRequest
): Promise<ScheduleLibraryItem> {
  return await apiRequestWithMapping<ScheduleLibraryItem>(
    `/api/1/Sites/${siteId}/ScheduleLibraryItems`,
    {
      method: 'POST',
      body: JSON.stringify(request)
    }
  );
}

export async function updateLibraryItem(
  itemId: number,
  request: UpdateLibraryItemRequest
): Promise<ScheduleLibraryItem> {
  return await apiRequestWithMapping<ScheduleLibraryItem>(
    `/api/1/ScheduleLibraryItems/${itemId}`,
    {
      method: 'PUT',
      body: JSON.stringify(request)
    }
  );
}

export async function deleteLibraryItem(itemId: number): Promise<void> {
  await apiRequestWithMapping(
    `/api/1/ScheduleLibraryItems/${itemId}`,
    { method: 'DELETE' }
  );
}

export async function cloneLibraryItem(
  itemId: number,
  request: CloneLibraryItemRequest
): Promise<ScheduleLibraryItem> {
  return await apiRequestWithMapping<ScheduleLibraryItem>(
    `/api/1/ScheduleLibraryItems/${itemId}/Clone`,
    {
      method: 'POST',
      body: JSON.stringify(request)
    }
  );
}

// ============================================================================
// Application Rules
// ============================================================================

export async function getApplicationRules(libraryItemId: number): Promise<ApplicationRule[]> {
  return await apiRequestWithMapping<ApplicationRule[]>(
    `/api/1/ScheduleLibraryItems/${libraryItemId}/ApplicationRules`
  );
}

export async function getAllApplicationRules(siteId: number): Promise<ApplicationRule[]> {
  return await apiRequestWithMapping<ApplicationRule[]>(
    `/api/1/Sites/${siteId}/ApplicationRules`
  );
}

export async function createApplicationRule(
  libraryItemId: number,
  request: CreateApplicationRuleRequest
): Promise<ApplicationRule> {
  return await apiRequestWithMapping<ApplicationRule>(
    `/api/1/ScheduleLibraryItems/${libraryItemId}/ApplicationRules`,
    {
      method: 'POST',
      body: JSON.stringify(request)
    }
  );
}

export async function deleteApplicationRule(ruleId: number): Promise<void> {
  await apiRequestWithMapping(
    `/api/1/ApplicationRules/${ruleId}`,
    { method: 'DELETE' }
  );
}

// ============================================================================
// Schedule Resolution
// ============================================================================

export async function getEffectiveSchedule(
  siteId: number,
  date: Date | string
): Promise<EffectiveScheduleResponse> {
  const dateStr = typeof date === 'string' ? date : toISODateString(date);
  return await apiRequestWithMapping<EffectiveScheduleResponse>(
    `/api/1/Sites/${siteId}/EffectiveSchedule?date=${dateStr}`
  );
}

export async function getCalendarSchedules(
  siteId: number,
  year: number,
  month: number
): Promise<Record<string, CalendarDaySchedule>> {
  return await apiRequestWithMapping<Record<string, CalendarDaySchedule>>(
    `/api/1/Sites/${siteId}/CalendarSchedules?year=${year}&month=${month}`
  );
}

export async function getCalendarSchedulesWithMatches(
  siteId: number,
  year: number,
  month: number
): Promise<Record<string, CalendarDayScheduleMatches>> {
  return await apiRequestWithMapping<Record<string, CalendarDayScheduleMatches>>(
    `/api/1/Sites/${siteId}/CalendarSchedulesWithMatches?year=${year}&month=${month}`
  );
}

/**
 * Gets all library items that have rules applicable to a specific date
 * Returns them sorted by specificity with the active (winning) one marked
 * This is used by CommandCalendar to show overridden schedules
 */
export async function getAllApplicableLibraryItems(
  siteId: number,
  date: Date
): Promise<Array<{ item: ScheduleLibraryItem; specificity: number; isActive: boolean }>> {
  const dateStr = toISODateString(date);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  // Get calendar data with all matches for the month
  const calendarData = await getCalendarSchedulesWithMatches(siteId, year, month);
  const dayMatches = calendarData[dateStr];

  if (!dayMatches) {
    return [];
  }

  // Get all library items for this site to have full details
  const allLibraryItems = await getLibraryItems(siteId);

  // Build result array with winning match first, then other matches
  const result: Array<{ item: ScheduleLibraryItem; specificity: number; isActive: boolean }> = [];

  // Add winning match
  const winningItem = allLibraryItems.find(item => item.id === dayMatches.winning_match.library_item_id);
  if (winningItem) {
    result.push({
      item: winningItem,
      specificity: dayMatches.winning_match.specificity,
      isActive: true
    });
  }

  // Add other matches
  for (const match of dayMatches.other_matches) {
    const item = allLibraryItems.find(i => i.id === match.library_item_id);
    if (item) {
      result.push({
        item,
        specificity: match.specificity,
        isActive: false
      });
    }
  }

  return result;
}

// ============================================================================
// Helpers
// ============================================================================

function toISODateString(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
