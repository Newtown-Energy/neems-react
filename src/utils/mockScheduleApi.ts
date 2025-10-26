/**
 * Mock Schedule API
 *
 * This module provides mock implementations of schedule template API calls
 * for UX development and testing before the real backend API is implemented.
 *
 * Uses localStorage to persist changes across page refreshes.
 */

import { debugLog } from './debug';

export interface MockScheduleTemplate {
  id: number;
  site_id: number;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
}

export interface MockScheduleTemplateEntry {
  id: number;
  template_id: number;
  execution_offset_seconds: number;
  schedule_command_id: number;
  command_type: 'charge' | 'discharge' | 'trickle_charge';
  is_active: boolean;
}

export interface MockSchedule {
  id: number;
  site_id: number;
  schedule_date: string; // ISO date string "YYYY-MM-DD"
  template_id: number | null; // null if custom, template_id if derived from template
  is_override: boolean; // true if overridden from default
}

export interface MockScheduleEntry {
  id: number;
  schedule_id: number;
  execution_offset_seconds: number;
  schedule_command_id: number;
  command_type: 'charge' | 'discharge' | 'trickle_charge';
  is_active: boolean;
}

// ============================================================================
// NEW: Schedule Library Interfaces
// ============================================================================

export interface ScheduleLibraryItem {
  id: number;
  site_id: number;
  name: string;
  description: string | null;
  commands: ScheduleCommand[];
  created_at: string; // ISO timestamp
}

export interface ScheduleCommand {
  id: number;
  execution_offset_seconds: number;
  command_type: 'charge' | 'discharge' | 'trickle_charge';
}

export type RuleType = 'default' | 'day_of_week' | 'specific_date';

export interface ApplicationRule {
  id: number;
  library_item_id: number;
  rule_type: RuleType;
  days_of_week: number[] | null; // [0-6] where 0=Sunday, multiple days allowed
  specific_dates: string[] | null; // Array of ISO dates ["2025-01-15"]
  created_at: string; // ISO timestamp - used for precedence
}

// Storage keys
const STORAGE_KEY_TEMPLATES = 'mock_schedule_templates';
const STORAGE_KEY_ENTRIES = 'mock_schedule_template_entries';
const STORAGE_KEY_SCHEDULES = 'mock_schedules';
const STORAGE_KEY_SCHEDULE_ENTRIES = 'mock_schedule_entries';

// NEW: Storage keys for library items and application rules
const STORAGE_KEY_LIBRARY_ITEMS = 'schedule_library_items';
const STORAGE_KEY_APPLICATION_RULES = 'application_rules';

// Default mock data
const DEFAULT_TEMPLATES: MockScheduleTemplate[] = [
  {
    id: 1,
    site_id: 1,
    name: 'Default Schedule',
    description: 'Default charging schedule for the site',
    is_default: true,
    is_active: true
  }
];

const DEFAULT_ENTRIES: MockScheduleTemplateEntry[] = [
  {
    id: 1,
    template_id: 1,
    execution_offset_seconds: 0, // 00:00 - Midnight trickle charge
    schedule_command_id: 1,
    command_type: 'trickle_charge',
    is_active: true
  },
  {
    id: 2,
    template_id: 1,
    execution_offset_seconds: 28800, // 08:00 - Morning charge
    schedule_command_id: 2,
    command_type: 'charge',
    is_active: true
  },
  {
    id: 3,
    template_id: 1,
    execution_offset_seconds: 57600, // 16:00 - Afternoon discharge
    schedule_command_id: 3,
    command_type: 'discharge',
    is_active: true
  }
];

// NEW: Default library items
const DEFAULT_LIBRARY_ITEMS: ScheduleLibraryItem[] = [
  {
    id: 1,
    site_id: 1,
    name: 'Default Schedule',
    description: 'Standard charging schedule for typical days',
    commands: [
      { id: 1, execution_offset_seconds: 0, command_type: 'trickle_charge' },
      { id: 2, execution_offset_seconds: 28800, command_type: 'charge' },
      { id: 3, execution_offset_seconds: 57600, command_type: 'discharge' }
    ],
    created_at: new Date('2025-01-01T00:00:00Z').toISOString()
  },
  {
    id: 2,
    site_id: 1,
    name: 'Weekday Heavy Charge',
    description: 'Aggressive charging schedule for weekdays',
    commands: [
      { id: 4, execution_offset_seconds: 21600, command_type: 'charge' }, // 06:00
      { id: 5, execution_offset_seconds: 43200, command_type: 'charge' }, // 12:00
      { id: 6, execution_offset_seconds: 61200, command_type: 'discharge' } // 17:00
    ],
    created_at: new Date('2025-01-02T00:00:00Z').toISOString()
  },
  {
    id: 3,
    site_id: 1,
    name: 'Weekend Light',
    description: 'Minimal operations for weekends',
    commands: [
      { id: 7, execution_offset_seconds: 32400, command_type: 'trickle_charge' }, // 09:00
      { id: 8, execution_offset_seconds: 54000, command_type: 'trickle_charge' } // 15:00
    ],
    created_at: new Date('2025-01-03T00:00:00Z').toISOString()
  }
];

// NEW: Default application rules
const DEFAULT_APPLICATION_RULES: ApplicationRule[] = [
  {
    id: 1,
    library_item_id: 1, // Default Schedule
    rule_type: 'default',
    days_of_week: null,
    specific_dates: null,
    created_at: new Date('2025-01-01T00:00:00Z').toISOString()
  },
  {
    id: 2,
    library_item_id: 2, // Weekday Heavy Charge
    rule_type: 'day_of_week',
    days_of_week: [1, 2, 3, 4, 5], // Monday-Friday
    specific_dates: null,
    created_at: new Date('2025-01-02T00:00:00Z').toISOString()
  },
  {
    id: 3,
    library_item_id: 3, // Weekend Light
    rule_type: 'day_of_week',
    days_of_week: [0, 6], // Sunday, Saturday
    specific_dates: null,
    created_at: new Date('2025-01-03T00:00:00Z').toISOString()
  }
];

// Helper to get data from localStorage with fallback
function getStoredTemplates(): MockScheduleTemplate[] {
  const stored = localStorage.getItem(STORAGE_KEY_TEMPLATES);
  return stored ? JSON.parse(stored) : DEFAULT_TEMPLATES;
}

function getStoredEntries(): MockScheduleTemplateEntry[] {
  const stored = localStorage.getItem(STORAGE_KEY_ENTRIES);
  return stored ? JSON.parse(stored) : DEFAULT_ENTRIES;
}

function getStoredSchedules(): MockSchedule[] {
  const stored = localStorage.getItem(STORAGE_KEY_SCHEDULES);
  return stored ? JSON.parse(stored) : [];
}

function getStoredScheduleEntries(): MockScheduleEntry[] {
  const stored = localStorage.getItem(STORAGE_KEY_SCHEDULE_ENTRIES);
  return stored ? JSON.parse(stored) : [];
}

function saveTemplates(templates: MockScheduleTemplate[]): void {
  localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(templates));
}

function saveEntries(entries: MockScheduleTemplateEntry[]): void {
  localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(entries));
}

function saveSchedules(schedules: MockSchedule[]): void {
  localStorage.setItem(STORAGE_KEY_SCHEDULES, JSON.stringify(schedules));
}

function saveScheduleEntries(entries: MockScheduleEntry[]): void {
  localStorage.setItem(STORAGE_KEY_SCHEDULE_ENTRIES, JSON.stringify(entries));
}

// NEW: Helper functions for library items and application rules
function getStoredLibraryItems(): ScheduleLibraryItem[] {
  const stored = localStorage.getItem(STORAGE_KEY_LIBRARY_ITEMS);
  return stored ? JSON.parse(stored) : DEFAULT_LIBRARY_ITEMS;
}

function getStoredApplicationRules(): ApplicationRule[] {
  const stored = localStorage.getItem(STORAGE_KEY_APPLICATION_RULES);
  return stored ? JSON.parse(stored) : DEFAULT_APPLICATION_RULES;
}

function saveLibraryItems(items: ScheduleLibraryItem[]): void {
  localStorage.setItem(STORAGE_KEY_LIBRARY_ITEMS, JSON.stringify(items));
}

function saveApplicationRules(rules: ApplicationRule[]): void {
  localStorage.setItem(STORAGE_KEY_APPLICATION_RULES, JSON.stringify(rules));
}

// Simulate network delay
function delay(ms = 300): Promise<void> {
  // eslint-disable-next-line promise/avoid-new -- Wrapping callback-based setTimeout API
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/**
 * Get the default template for a site
 */
export async function getMockDefaultTemplate(siteId: number): Promise<MockScheduleTemplate | null> {
  await delay();
  const templates = getStoredTemplates();
  return templates.find(t => t.site_id === siteId && t.is_default) || null;
}

/**
 * Get all templates for a site
 */
export async function getMockTemplates(siteId: number): Promise<MockScheduleTemplate[]> {
  await delay();
  const templates = getStoredTemplates();
  return templates.filter(t => t.site_id === siteId);
}

/**
 * Get all template entries for a template, sorted by execution_offset_seconds
 */
export async function getMockTemplateEntries(templateId: number): Promise<MockScheduleTemplateEntry[]> {
  await delay();
  const entries = getStoredEntries();
  return entries
    .filter(e => e.template_id === templateId)
    .sort((a, b) => a.execution_offset_seconds - b.execution_offset_seconds);
}

/**
 * Create a new template entry
 */
export async function createMockTemplateEntry(
  entry: Omit<MockScheduleTemplateEntry, 'id' | 'schedule_command_id'>
): Promise<MockScheduleTemplateEntry> {
  await delay();
  const entries = getStoredEntries();

  // Generate new ID
  const newId = entries.length > 0 ? Math.max(...entries.map(e => e.id)) + 1 : 1;

  // Generate mock schedule_command_id
  const commandId = newId + 100; // Offset to avoid collision

  const newEntry: MockScheduleTemplateEntry = {
    ...entry,
    id: newId,
    schedule_command_id: commandId
  };

  entries.push(newEntry);
  saveEntries(entries);

  return newEntry;
}

/**
 * Update an existing template entry
 */
export async function updateMockTemplateEntry(
  id: number,
  updates: Partial<Omit<MockScheduleTemplateEntry, 'id' | 'template_id' | 'schedule_command_id'>>
): Promise<MockScheduleTemplateEntry> {
  await delay();
  const entries = getStoredEntries();
  const index = entries.findIndex(e => e.id === id);

  if (index === -1) {
    throw new Error(`Template entry with id ${id} not found`);
  }

  entries[index] = {
    ...entries[index],
    ...updates
  };

  saveEntries(entries);
  return entries[index];
}

/**
 * Delete a template entry
 */
export async function deleteMockTemplateEntry(id: number): Promise<void> {
  await delay();
  const entries = getStoredEntries();
  const filtered = entries.filter(e => e.id !== id);

  if (filtered.length === entries.length) {
    throw new Error(`Template entry with id ${id} not found`);
  }

  saveEntries(filtered);
}

// ============================================================================
// NEW: Schedule Library API Functions
// ============================================================================

/**
 * Get all library items for a site
 */
export async function getLibraryItems(siteId: number): Promise<ScheduleLibraryItem[]> {
  await delay();
  const items = getStoredLibraryItems();
  return items.filter(item => item.site_id === siteId);
}

/**
 * Get a single library item by ID
 */
export async function getLibraryItem(itemId: number): Promise<ScheduleLibraryItem | null> {
  await delay();
  const items = getStoredLibraryItems();
  return items.find(item => item.id === itemId) || null;
}

/**
 * Create a new library item
 */
export async function createLibraryItem(
  item: Omit<ScheduleLibraryItem, 'id' | 'created_at'>
): Promise<ScheduleLibraryItem> {
  await delay();
  const items = getStoredLibraryItems();

  // Generate new ID
  const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;

  const newItem: ScheduleLibraryItem = {
    ...item,
    id: newId,
    created_at: new Date().toISOString()
  };

  items.push(newItem);
  saveLibraryItems(items);

  return newItem;
}

/**
 * Update an existing library item
 */
export async function updateLibraryItem(
  itemId: number,
  updates: Partial<Omit<ScheduleLibraryItem, 'id' | 'created_at'>>
): Promise<ScheduleLibraryItem> {
  await delay();
  const items = getStoredLibraryItems();
  const index = items.findIndex(item => item.id === itemId);

  if (index === -1) {
    throw new Error(`Library item with id ${itemId} not found`);
  }

  items[index] = {
    ...items[index],
    ...updates
  };

  saveLibraryItems(items);
  return items[index];
}

/**
 * Delete a library item
 * Also deletes all associated application rules
 */
export async function deleteLibraryItem(itemId: number): Promise<void> {
  await delay();
  const items = getStoredLibraryItems();
  const filtered = items.filter(item => item.id !== itemId);

  if (filtered.length === items.length) {
    throw new Error(`Library item with id ${itemId} not found`);
  }

  saveLibraryItems(filtered);

  // Also delete all application rules for this item
  const rules = getStoredApplicationRules();
  const filteredRules = rules.filter(rule => rule.library_item_id !== itemId);
  saveApplicationRules(filteredRules);
}

/**
 * Clone a library item (for edit-from-calendar flow)
 */
export async function cloneLibraryItem(
  itemId: number,
  newName: string
): Promise<ScheduleLibraryItem> {
  await delay();
  const items = getStoredLibraryItems();
  const original = items.find(item => item.id === itemId);

  if (!original) {
    throw new Error(`Library item with id ${itemId} not found`);
  }

  // Clone with new name and fresh IDs
  const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
  const maxCommandId = Math.max(...items.flatMap(i => i.commands.map(c => c.id)), 0);

  const clonedItem: ScheduleLibraryItem = {
    ...original,
    id: newId,
    name: newName,
    commands: original.commands.map((cmd, idx) => ({
      ...cmd,
      id: maxCommandId + idx + 1
    })),
    created_at: new Date().toISOString()
  };

  items.push(clonedItem);
  saveLibraryItems(items);

  return clonedItem;
}

// ============================================================================
// NEW: Application Rules API Functions
// ============================================================================

/**
 * Get all application rules for a library item
 */
export async function getApplicationRules(libraryItemId: number): Promise<ApplicationRule[]> {
  await delay();
  const rules = getStoredApplicationRules();
  return rules.filter(rule => rule.library_item_id === libraryItemId);
}

/**
 * Get all application rules for a site (across all library items)
 */
export async function getAllApplicationRules(siteId: number): Promise<ApplicationRule[]> {
  await delay();
  const items = getStoredLibraryItems();
  const siteItemIds = items.filter(item => item.site_id === siteId).map(item => item.id);

  const rules = getStoredApplicationRules();
  return rules.filter(rule => siteItemIds.includes(rule.library_item_id));
}

/**
 * Create a new application rule
 */
export async function createApplicationRule(
  rule: Omit<ApplicationRule, 'id' | 'created_at'>
): Promise<ApplicationRule> {
  await delay();
  const rules = getStoredApplicationRules();

  // If this is a default rule, remove any existing default rules for the same site
  if (rule.rule_type === 'default') {
    const items = getStoredLibraryItems();
    const item = items.find(i => i.id === rule.library_item_id);
    if (item) {
      const siteItemIds = items.filter(i => i.site_id === item.site_id).map(i => i.id);
      const filteredRules = rules.filter(
        r => !(r.rule_type === 'default' && siteItemIds.includes(r.library_item_id))
      );
      saveApplicationRules(filteredRules);
    }
  }

  // Generate new ID
  const newId = rules.length > 0 ? Math.max(...rules.map(r => r.id)) + 1 : 1;

  const newRule: ApplicationRule = {
    ...rule,
    id: newId,
    created_at: new Date().toISOString()
  };

  const updatedRules = getStoredApplicationRules(); // Re-fetch in case we deleted default
  updatedRules.push(newRule);
  saveApplicationRules(updatedRules);

  return newRule;
}

/**
 * Delete an application rule
 */
export async function deleteApplicationRule(ruleId: number): Promise<void> {
  await delay();
  const rules = getStoredApplicationRules();
  const filtered = rules.filter(rule => rule.id !== ruleId);

  if (filtered.length === rules.length) {
    throw new Error(`Application rule with id ${ruleId} not found`);
  }

  saveApplicationRules(filtered);
}

/**
 * Get the effective library item for a specific date
 * Applies precedence rules: Specific Date > Day of Week > Default
 * For same specificity, most recent rule wins
 */
/**
 * Get the effective library item and its specificity for a given date
 */
export async function getEffectiveLibraryItemWithSpecificity(
  siteId: number,
  date: Date
): Promise<{ item: ScheduleLibraryItem | null; specificity: number } | null> {
  await delay();

  const items = getStoredLibraryItems();
  const siteItems = items.filter(item => item.site_id === siteId);

  if (siteItems.length === 0) {
    debugLog('mockScheduleApi: No library items found for site', siteId);
    return null;
  }

  const rules = getStoredApplicationRules();
  const dateString = toISODateString(date);
  const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday

  debugLog('mockScheduleApi: Finding schedule for date', {
    date: dateString,
    dayOfWeek,
    dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
    totalRules: rules.length
  });

  // Find all rules that match this date
  const matchingRules: Array<{ rule: ApplicationRule; specificity: number }> = [];

  for (const rule of rules) {
    const item = siteItems.find(i => i.id === rule.library_item_id);
    if (!item) continue;

    if (rule.rule_type === 'specific_date') {
      if (rule.specific_dates?.includes(dateString)) {
        matchingRules.push({ rule, specificity: 2 }); // Highest
        debugLog('mockScheduleApi: Matched specific date rule', {
          ruleId: rule.id,
          libraryItemName: item.name,
          specificity: 2
        });
      }
    } else if (rule.rule_type === 'day_of_week') {
      if (rule.days_of_week?.includes(dayOfWeek)) {
        matchingRules.push({ rule, specificity: 1 }); // Medium
        debugLog('mockScheduleApi: Matched day-of-week rule', {
          ruleId: rule.id,
          libraryItemName: item.name,
          daysOfWeek: rule.days_of_week,
          specificity: 1
        });
      }
    } else if (rule.rule_type === 'default') {
      matchingRules.push({ rule, specificity: 0 }); // Lowest
      debugLog('mockScheduleApi: Matched default rule', {
        ruleId: rule.id,
        libraryItemName: item.name,
        specificity: 0
      });
    }
  }

  if (matchingRules.length === 0) {
    debugLog('mockScheduleApi: No matching rules found for date', dateString);
    return null;
  }

  // Sort by specificity (desc), then by created_at (desc)
  matchingRules.sort((a, b) => {
    if (a.specificity !== b.specificity) {
      return b.specificity - a.specificity;
    }
    return new Date(b.rule.created_at).getTime() - new Date(a.rule.created_at).getTime();
  });

  // Return the library item and specificity for the winning rule
  const winningMatch = matchingRules[0];
  const item = siteItems.find(item => item.id === winningMatch.rule.library_item_id) || null;

  debugLog('mockScheduleApi: Winning schedule', {
    date: dateString,
    schedule: item?.name,
    specificity: winningMatch.specificity,
    specificityType: ['default', 'day-of-week', 'specific-date'][winningMatch.specificity],
    totalMatches: matchingRules.length
  });

  return { item, specificity: winningMatch.specificity };
}

export async function getEffectiveLibraryItem(
  siteId: number,
  date: Date
): Promise<ScheduleLibraryItem | null> {
  const result = await getEffectiveLibraryItemWithSpecificity(siteId, date);
  return result?.item || null;
}

// Helper function to convert Date to ISO date string (used in getEffectiveLibraryItem)
function toISODateString(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Reset mock data to defaults (useful for testing)
 */
export function resetMockData(): void {
  saveTemplates(DEFAULT_TEMPLATES);
  saveEntries(DEFAULT_ENTRIES);
  localStorage.removeItem(STORAGE_KEY_SCHEDULES);
  localStorage.removeItem(STORAGE_KEY_SCHEDULE_ENTRIES);
  saveLibraryItems(DEFAULT_LIBRARY_ITEMS);
  saveApplicationRules(DEFAULT_APPLICATION_RULES);
}

/**
 * Get schedule for a specific date
 * Returns null if no override exists (use default template)
 */
export async function getMockScheduleForDate(siteId: number, date: string): Promise<MockSchedule | null> {
  await delay();
  const schedules = getStoredSchedules();
  return schedules.find(s => s.site_id === siteId && s.schedule_date === date) || null;
}

/**
 * Get all schedule entries for a specific schedule, sorted by execution_offset_seconds
 */
export async function getMockScheduleEntries(scheduleId: number): Promise<MockScheduleEntry[]> {
  await delay();
  const entries = getStoredScheduleEntries();
  return entries
    .filter(e => e.schedule_id === scheduleId)
    .sort((a, b) => a.execution_offset_seconds - b.execution_offset_seconds);
}

/**
 * Create a schedule override for a specific date by copying the default template
 */
export async function createMockScheduleOverride(
  siteId: number,
  date: string
): Promise<{schedule: MockSchedule; entries: MockScheduleEntry[]}> {
  await delay();

  // Get default template
  const defaultTemplate = await getMockDefaultTemplate(siteId);
  if (!defaultTemplate) {
    throw new Error('No default template found');
  }

  // Get template entries to copy
  const templateEntries = await getMockTemplateEntries(defaultTemplate.id);

  const schedules = getStoredSchedules();
  const scheduleEntries = getStoredScheduleEntries();

  // Generate new schedule ID
  const newScheduleId = schedules.length > 0 ? Math.max(...schedules.map(s => s.id)) + 1 : 1;

  // Create new schedule
  const newSchedule: MockSchedule = {
    id: newScheduleId,
    site_id: siteId,
    schedule_date: date,
    template_id: defaultTemplate.id,
    is_override: true
  };

  schedules.push(newSchedule);
  saveSchedules(schedules);

  // Copy template entries to schedule entries
  const newEntries: MockScheduleEntry[] = templateEntries.map((templateEntry, index) => {
    const newId = scheduleEntries.length > 0
      ? Math.max(...scheduleEntries.map(e => e.id)) + index + 1
      : index + 1;

    return {
      id: newId,
      schedule_id: newScheduleId,
      execution_offset_seconds: templateEntry.execution_offset_seconds,
      schedule_command_id: templateEntry.schedule_command_id,
      command_type: templateEntry.command_type,
      is_active: templateEntry.is_active
    };
  });

  scheduleEntries.push(...newEntries);
  saveScheduleEntries(scheduleEntries);

  return {
    schedule: newSchedule,
    entries: newEntries
  };
}

/**
 * Create a new schedule entry for a specific schedule
 */
export async function createMockScheduleEntry(
  entry: Omit<MockScheduleEntry, 'id' | 'schedule_command_id'>
): Promise<MockScheduleEntry> {
  await delay();
  const entries = getStoredScheduleEntries();

  // Generate new ID
  const newId = entries.length > 0 ? Math.max(...entries.map(e => e.id)) + 1 : 1;

  // Generate mock schedule_command_id
  const commandId = newId + 1000; // Offset to avoid collision

  const newEntry: MockScheduleEntry = {
    ...entry,
    id: newId,
    schedule_command_id: commandId
  };

  entries.push(newEntry);
  saveScheduleEntries(entries);

  return newEntry;
}

/**
 * Update an existing schedule entry
 */
export async function updateMockScheduleEntry(
  id: number,
  updates: Partial<Omit<MockScheduleEntry, 'id' | 'schedule_id' | 'schedule_command_id'>>
): Promise<MockScheduleEntry> {
  await delay();
  const entries = getStoredScheduleEntries();
  const index = entries.findIndex(e => e.id === id);

  if (index === -1) {
    throw new Error(`Schedule entry with id ${id} not found`);
  }

  entries[index] = {
    ...entries[index],
    ...updates
  };

  saveScheduleEntries(entries);
  return entries[index];
}

/**
 * Delete a schedule entry
 */
export async function deleteMockScheduleEntry(id: number): Promise<void> {
  await delay();
  const entries = getStoredScheduleEntries();
  const filtered = entries.filter(e => e.id !== id);

  if (filtered.length === entries.length) {
    throw new Error(`Schedule entry with id ${id} not found`);
  }

  saveScheduleEntries(filtered);
}
