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

// Storage keys
const STORAGE_KEY_TEMPLATES = 'mock_schedule_templates';
const STORAGE_KEY_ENTRIES = 'mock_schedule_template_entries';

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

function saveTemplates(templates: MockScheduleTemplate[]): void {
  localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(templates));
}

function saveEntries(entries: MockScheduleTemplateEntry[]): void {
  localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(entries));
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
}
