# Schedule Library System - Frontend Integration Guide

**Location:** `neems-react/`
**Phase:** Phase 3 (Frontend Integration)
**Prerequisites:** Backend API completed (see `../neems-core/BACKEND_IMPLEMENTATION.md`)

---

## Table of Contents

1. [Overview](#overview)
2. [What Changed in Backend](#what-changed-in-backend)
3. [Integration Steps](#integration-steps)
4. [API Client Updates](#api-client-updates)
5. [Component Updates](#component-updates)
6. [Testing](#testing)
7. [Cleanup](#cleanup)

---

## Overview

The Schedule Library system was prototyped using mock localStorage API in `src/utils/mockScheduleApi.ts`. The backend is now complete, and this guide covers connecting the React frontend to the real API.

### Goals

1. Replace mock API calls with real API requests
2. Update type imports to use generated types
3. Remove localStorage dependencies
4. Verify end-to-end functionality
5. Clean up mock code

---

## What Changed in Backend

### New TypeScript Types (Auto-Generated)

These should now exist in `src/types/generated/`:

- `ScheduleLibraryItem.ts`
- `ScheduleCommand.ts`
- `CommandType.ts`
- `ApplicationRule.ts`
- `RuleType.ts`
- `CreateLibraryItemRequest.ts`
- `UpdateLibraryItemRequest.ts`
- `CloneLibraryItemRequest.ts`
- `CreateApplicationRuleRequest.ts`
- `EffectiveScheduleResponse.ts`
- `CalendarDaySchedule.ts`

### New API Endpoints

| Mock Function | Real Endpoint |
|---------------|---------------|
| `getLibraryItems(siteId)` | `GET /api/1/Sites/{siteId}/ScheduleLibraryItems` |
| `getLibraryItem(itemId)` | `GET /api/1/ScheduleLibraryItems/{itemId}` |
| `createLibraryItem(item)` | `POST /api/1/Sites/{siteId}/ScheduleLibraryItems` |
| `updateLibraryItem(itemId, updates)` | `PUT /api/1/ScheduleLibraryItems/{itemId}` |
| `deleteLibraryItem(itemId)` | `DELETE /api/1/ScheduleLibraryItems/{itemId}` |
| `cloneLibraryItem(itemId, name)` | `POST /api/1/ScheduleLibraryItems/{itemId}/Clone` |
| `getApplicationRules(itemId)` | `GET /api/1/ScheduleLibraryItems/{itemId}/ApplicationRules` |
| `getAllApplicationRules(siteId)` | `GET /api/1/Sites/{siteId}/ApplicationRules` |
| `createApplicationRule(rule)` | `POST /api/1/ScheduleLibraryItems/{itemId}/ApplicationRules` |
| `deleteApplicationRule(ruleId)` | `DELETE /api/1/ApplicationRules/{ruleId}` |
| `getEffectiveLibraryItem(siteId, date)` | `GET /api/1/Sites/{siteId}/EffectiveSchedule?date={iso}` |

---

## Integration Steps

### Step 1: Verify Generated Types

Check that types were generated:

```bash
ls -la src/types/generated/ | grep -i schedule
```

You should see the files listed above. If not, regenerate from backend:

```bash
cd ../neems-core/neems-api
cargo test --features test-staging generate_typescript_types -- --nocapture
```

### Step 2: Create Real API Module

**File: `src/utils/scheduleApi.ts`** (NEW)

```typescript
import { apiRequestWithMapping } from './api';
import type { ScheduleLibraryItem } from '../types/generated/ScheduleLibraryItem';
import type { ApplicationRule } from '../types/generated/ApplicationRule';
import type { CreateLibraryItemRequest } from '../types/generated/CreateLibraryItemRequest';
import type { UpdateLibraryItemRequest } from '../types/generated/UpdateLibraryItemRequest';
import type { CloneLibraryItemRequest } from '../types/generated/CloneLibraryItemRequest';
import type { CreateApplicationRuleRequest } from '../types/generated/CreateApplicationRuleRequest';
import type { EffectiveScheduleResponse } from '../types/generated/EffectiveScheduleResponse';
import type { CalendarDaySchedule } from '../types/generated/CalendarDaySchedule';

// ============================================================================
// Library Items
// ============================================================================

export async function getLibraryItems(siteId: number): Promise<ScheduleLibraryItem[]> {
  return apiRequestWithMapping<ScheduleLibraryItem[]>(
    `/api/1/Sites/${siteId}/ScheduleLibraryItems`
  );
}

export async function getLibraryItem(itemId: number): Promise<ScheduleLibraryItem> {
  return apiRequestWithMapping<ScheduleLibraryItem>(
    `/api/1/ScheduleLibraryItems/${itemId}`
  );
}

export async function createLibraryItem(
  siteId: number,
  request: CreateLibraryItemRequest
): Promise<ScheduleLibraryItem> {
  return apiRequestWithMapping<ScheduleLibraryItem>(
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
  return apiRequestWithMapping<ScheduleLibraryItem>(
    `/api/1/ScheduleLibraryItems/${itemId}`,
    {
      method: 'PUT',
      body: JSON.stringify(request)
    }
  );
}

export async function deleteLibraryItem(itemId: number): Promise<void> {
  await apiRequestWithMapping<void>(
    `/api/1/ScheduleLibraryItems/${itemId}`,
    { method: 'DELETE' }
  );
}

export async function cloneLibraryItem(
  itemId: number,
  request: CloneLibraryItemRequest
): Promise<ScheduleLibraryItem> {
  return apiRequestWithMapping<ScheduleLibraryItem>(
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
  return apiRequestWithMapping<ApplicationRule[]>(
    `/api/1/ScheduleLibraryItems/${libraryItemId}/ApplicationRules`
  );
}

export async function getAllApplicationRules(siteId: number): Promise<ApplicationRule[]> {
  return apiRequestWithMapping<ApplicationRule[]>(
    `/api/1/Sites/${siteId}/ApplicationRules`
  );
}

export async function createApplicationRule(
  libraryItemId: number,
  request: CreateApplicationRuleRequest
): Promise<ApplicationRule> {
  return apiRequestWithMapping<ApplicationRule>(
    `/api/1/ScheduleLibraryItems/${libraryItemId}/ApplicationRules`,
    {
      method: 'POST',
      body: JSON.stringify(request)
    }
  );
}

export async function deleteApplicationRule(ruleId: number): Promise<void> {
  await apiRequestWithMapping<void>(
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
  return apiRequestWithMapping<EffectiveScheduleResponse>(
    `/api/1/Sites/${siteId}/EffectiveSchedule?date=${dateStr}`
  );
}

export async function getCalendarSchedules(
  siteId: number,
  year: number,
  month: number
): Promise<Record<string, CalendarDaySchedule>> {
  return apiRequestWithMapping<Record<string, CalendarDaySchedule>>(
    `/api/1/Sites/${siteId}/CalendarSchedules?year=${year}&month=${month}`
  );
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
```

### Step 3: Update Component Imports

**Strategy:** Find and replace imports across all components.

#### Find All Mock API Imports

```bash
grep -r "from.*mockScheduleApi" src/
```

#### Replace Pattern

**Old:**
```typescript
import { getLibraryItems, createLibraryItem, ... } from '../utils/mockScheduleApi';
```

**New:**
```typescript
import { getLibraryItems, createLibraryItem, ... } from '../utils/scheduleApi';
```

#### Files to Update

Based on your codebase:
- `src/pages/SchedulerPage.tsx`
- `src/pages/LibraryPage.tsx`
- `src/components/ScheduleLibrary/ScheduleLibrary.tsx`
- `src/components/ApplicationRuleDialog/ApplicationRuleDialog.tsx`
- `src/components/CommandCalendar/CommandCalendar.tsx`

### Step 4: Update Type Imports

Replace local type imports with generated types.

**Old:**
```typescript
import type { ScheduleLibraryItem, ApplicationRule } from '../utils/mockScheduleApi';
```

**New:**
```typescript
import type { ScheduleLibraryItem } from '../types/generated/ScheduleLibraryItem';
import type { ApplicationRule } from '../types/generated/ApplicationRule';
import type { CommandType } from '../types/generated/CommandType';
import type { RuleType } from '../types/generated/RuleType';
```

**Note:** `ScheduleCommand` is now defined in generated types, but helper types may still be needed locally (e.g., component-specific interfaces).

---

## API Client Updates

### Handle Response Differences

The real API may have slightly different response shapes than the mock. Key differences:

#### Library Item Response

Mock API embedded commands directly. Real API does the same, but verify:

```typescript
// Both should match:
interface ScheduleLibraryItem {
  id: number;
  site_id: number;
  name: string;
  description: string | null;
  commands: ScheduleCommand[];
  created_at: string;
}
```

#### Effective Schedule Response

Mock returned `{ item, specificity }`. Real API returns:

```typescript
interface EffectiveScheduleResponse {
  library_item: ScheduleLibraryItem;
  specificity: number;  // 0, 1, or 2
  rule: ApplicationRule;
}
```

**Update components to use:**
```typescript
const result = await getEffectiveSchedule(siteId, date);
const item = result.library_item;
const specificity = result.specificity;
```

### Error Handling

The real API uses standard `ApiError` from `src/utils/api.ts`. Ensure error handling matches:

```typescript
try {
  const items = await getLibraryItems(siteId);
  setLibraryItems(items);
} catch (err) {
  if (err instanceof ApiError) {
    setError(err.message);
  } else {
    setError('An unexpected error occurred');
  }
}
```

---

## Component Updates

### SchedulerPage.tsx

**Changes needed:**
1. Import `scheduleApi` instead of `mockScheduleApi`
2. Update `getEffectiveSchedule` to handle `EffectiveScheduleResponse`
3. Remove any localStorage reset logic

**Example:**
```typescript
// Old
import { getEffectiveLibraryItemWithSpecificity } from '../utils/mockScheduleApi';

const result = await getEffectiveLibraryItemWithSpecificity(siteId, date);
const item = result?.item;
const specificity = result?.specificity;

// New
import { getEffectiveSchedule } from '../utils/scheduleApi';

const result = await getEffectiveSchedule(siteId, date);
const item = result.library_item;
const specificity = result.specificity;
```

### LibraryPage.tsx

**Changes needed:**
1. Import real API functions
2. Remove mock data reset buttons (if any)
3. Verify error handling

### ScheduleLibrary.tsx

**Changes needed:**
1. Update CRUD operations to use real API
2. Handle async responses (already should be doing this)
3. Verify loading states

### ApplicationRuleDialog.tsx

**Changes needed:**
1. Update rule creation/deletion to use real API
2. Handle `library_item_id` vs `template_id` (API uses `library_item_id` in responses)

### CommandCalendar.tsx

**Changes needed:**
1. Update calendar data fetching
2. If using `getCalendarSchedules`, update to handle response format

---

## Testing

### Manual Testing Checklist

#### Library Management
- [ ] Create new schedule from Library page
- [ ] Edit schedule name
- [ ] Edit schedule commands (add, update, delete)
- [ ] Delete schedule
- [ ] Verify unique name validation
- [ ] Verify execution time validation (0-86399)
- [ ] Verify duplicate time validation

#### Application Rules
- [ ] Create default rule
- [ ] Create day-of-week rule (e.g., Monday-Friday)
- [ ] Create specific-date rule from calendar
- [ ] Delete rule
- [ ] Verify only one default per site (creating new removes old)
- [ ] View rules in ApplicationRuleDialog

#### Schedule Resolution
- [ ] Calendar shows correct schedule per day
- [ ] Specific date override shows highest specificity
- [ ] Day-of-week rule shows medium specificity
- [ ] Default rule shows lowest specificity
- [ ] Click day in calendar shows correct schedule
- [ ] Create override from calendar dialog

#### Navigation & UX
- [ ] Navigate Library ↔ Scheduler pages
- [ ] Site selector works
- [ ] Month navigation in calendar
- [ ] Expandable schedule details
- [ ] Loading states display correctly
- [ ] Error messages display correctly

### E2E Tests

Update existing tests in `test/jest/` if they exist:

```typescript
// Example test update
describe('Schedule Library', () => {
  it('should create a new schedule', async () => {
    // Login
    await page.goto('http://localhost:5173/library');

    // Create schedule
    await page.click('[data-testid="create-schedule-button"]');
    await page.fill('[data-testid="schedule-name"]', 'Test Schedule');
    await page.click('[data-testid="save-button"]');

    // Verify created
    await page.waitForSelector('text=Test Schedule');
    expect(await page.textContent('h6')).toContain('Test Schedule');
  });
});
```

---

## Cleanup

### Step 1: Remove Mock API File

Once everything works with real API:

```bash
git rm src/utils/mockScheduleApi.ts
```

**Keep:** `src/utils/scheduleHelpers.ts` - Still useful for time conversion, formatting, etc.

### Step 2: Remove localStorage Code

Search for and remove:
- `localStorage.getItem('schedule_library_items')`
- `localStorage.setItem('schedule_library_items')`
- Any references to mock storage keys
- "Reset Mock Data" buttons (if any)

```bash
grep -r "localStorage" src/ | grep -i schedule
```

### Step 3: Update Documentation

Update `AGENTS.md`:

**Remove:**
- Mock API section
- localStorage persistence notes

**Add:**
- Real API endpoint documentation
- Generated type locations
- Error handling patterns

**Example addition:**
```markdown
### Schedule Library API

The schedule library system uses these API endpoints:

**Library Items:**
- `GET /api/1/Sites/{siteId}/ScheduleLibraryItems` - List schedules for site
- `POST /api/1/Sites/{siteId}/ScheduleLibraryItems` - Create schedule
- `PUT /api/1/ScheduleLibraryItems/{id}` - Update schedule
- `DELETE /api/1/ScheduleLibraryItems/{id}` - Delete schedule

**Application Rules:**
- `GET /api/1/ScheduleLibraryItems/{id}/ApplicationRules` - Get rules
- `POST /api/1/ScheduleLibraryItems/{id}/ApplicationRules` - Create rule
- `DELETE /api/1/ApplicationRules/{id}` - Delete rule

**Types:**
Generated types in `src/types/generated/`:
- `ScheduleLibraryItem` - Library item with embedded commands
- `ApplicationRule` - Rule determining schedule application
- `CommandType` - Enum: charge, discharge, trickle_charge
- `RuleType` - Enum: default, day_of_week, specific_date
```

### Step 4: Final Verification

- [ ] `bun run lint:tsc` passes (no type errors)
- [ ] `bun run lint:eslint` passes
- [ ] `bun run build` succeeds
- [ ] No console errors in browser
- [ ] All features work end-to-end
- [ ] No references to `mockScheduleApi` remain
- [ ] Documentation updated

---

## Common Issues & Solutions

### Issue: Generated types not found

**Solution:**
```bash
cd ../neems-core/neems-api
cargo test --features test-staging generate_typescript_types -- --nocapture
```

Verify files created in `src/types/generated/`.

### Issue: API returns 404

**Solution:**
- Verify backend is running
- Check route registration in `neems-api/src/api/mod.rs`
- Check endpoint URL matches backend implementation

### Issue: CORS errors

**Solution:**
- Ensure Vite proxy configured correctly in `vite.config.ts`
- Check backend CORS settings (should allow frontend origin)

### Issue: Type mismatches

**Solution:**
- Check generated type vs. component expectation
- May need to map response to component-specific interface
- Update component types to match generated types

### Issue: Authorization failures (403)

**Solution:**
- Verify user has correct role (admin for write operations)
- Check session cookie is being sent
- Test with newtown-admin account first

---

## Success Criteria

Integration is complete when:

1. ✅ All mock API imports replaced with real API
2. ✅ All type imports use generated types
3. ✅ No localStorage references for schedule data
4. ✅ `mockScheduleApi.ts` deleted
5. ✅ All manual tests pass
6. ✅ E2E tests updated and passing
7. ✅ No TypeScript errors
8. ✅ No console errors
9. ✅ Documentation updated
10. ✅ Code builds and runs in production mode

---

## Next Steps

After frontend integration:

1. Update `../INSTRUCTIONS.md` with any learnings
2. Update both `AGENTS.md` files (frontend and backend)
3. Consider performance optimizations (caching, pagination)
4. Plan future enhancements (command parameters, bulk operations, etc.)

---

**Last Updated:** 2025-12-14
**Author:** AI Agent (Claude Code)
