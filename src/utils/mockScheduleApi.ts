/**
 * Mock Schedule API
 *
 * This module provides mock implementations of schedule template API calls
 * for UX development and testing before the real backend API is implemented.
 *
 * Uses localStorage to persist changes across page refreshes.
 */

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

// Storage keys
const STORAGE_KEY_TEMPLATES = 'mock_schedule_templates';
const STORAGE_KEY_ENTRIES = 'mock_schedule_template_entries';
const STORAGE_KEY_SCHEDULES = 'mock_schedules';
const STORAGE_KEY_SCHEDULE_ENTRIES = 'mock_schedule_entries';

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

// Simulate network delay
function delay(ms: number = 300): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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

/**
 * Reset mock data to defaults (useful for testing)
 */
export function resetMockData(): void {
  saveTemplates(DEFAULT_TEMPLATES);
  saveEntries(DEFAULT_ENTRIES);
  localStorage.removeItem(STORAGE_KEY_SCHEDULES);
  localStorage.removeItem(STORAGE_KEY_SCHEDULE_ENTRIES);
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
