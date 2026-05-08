# AI Agent Development Guidelines - NEEMS React

This document provides critical guidelines for AI agents (like Claude Code) working on the NEEMS React frontend.

**IMPORTANT: Keep This File Updated**

This is a **repository artifact** that should be maintained for any developer working on the project, not just your local environment.

When making significant changes to the codebase, update this file to reflect:
- New architectural patterns or conventions
- Changes to API patterns or endpoints
- New components or page structures
- Updates to development workflow or tooling
- Changes to testing approach or dependencies

**Guidelines for updates:**
- Write for a general developer environment (avoid local paths, personal configurations, or machine-specific details)
- Document repository structure, conventions, and patterns that apply to all developers
- Include both Docker and non-Docker approaches where applicable
- Don't include absolute file paths specific to your machine
- Don't include personal credentials, API keys, or local environment variables
- Don't assume a specific IDE, OS, or development setup

This helps future AI agents (and developers) understand the current state of the project regardless of their development environment.

## Project Overview

NEEMS React is the frontend web interface for a Battery Energy Storage System (BESS) Energy Management System (EMS). It provides dashboards, controls, and administrative interfaces for managing battery systems.

**Key Technologies:**
- React 19 with TypeScript
- Material-UI (MUI) for components
- Vite for build tooling
- React Router for navigation
- SCSS for styling
- Bun for package management
- Jest + Puppeteer for E2E browser automation tests (no unit tests currently)

## Docker-Based Development (Optional)

**Note: This section applies if using the Docker-based development setup with devenv.**

**CRITICAL RULE: ALL docker compose commands MUST be run from `../devenv/` directory.**

This project can be part of a larger Docker-based development environment. The `docker-compose.yml` file is located in `../devenv/`, NOT in this directory.

### Important: Working Directory for Docker Commands

**Always `cd ../devenv` before running docker compose commands!**

### Quick Reference for This Container

```bash
# Access this container (MUST run from ../devenv)
cd ../devenv
docker compose exec neems-react bash

# Common commands (MUST run from ../devenv)
cd ../devenv
docker compose exec neems-react npm install
docker compose exec neems-react npm run dev
docker compose exec neems-react npm run build
docker compose exec neems-react npm run lint:tsc
docker compose exec neems-react npm run lint

# E2E tests run on the host (Puppeteer needs a local Chrome), not inside the
# container. With the dev server running, use `bin/dosh test` from neems-react/.

# Check container status
cd ../devenv
docker compose ps

# View logs
cd ../devenv
docker compose logs -f neems-react

# Start all services
cd ../devenv
docker compose up -d
```

### Exception: Host Machine Commands

The ONLY commands that should run on the host machine are:
- `docker compose` commands for container orchestration (from `../devenv/`)
- Git operations (`git add`, `git commit`, `git push`, etc.)
- File operations using AI tools (Read, Write, Edit)
- Text search and file globbing (Grep, Glob)

## Standard Development (Without Docker)

If not using Docker, you can develop directly on your host machine:

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Run E2E tests (against the dev server started above)
bin/dosh test

# Type checking
bun run lint:tsc

# Linting
bun run lint:eslint

# Build for production
bun run build
```

**Note:** The rest of this document uses Docker commands in examples. If developing without Docker, replace:
- `docker compose exec neems-react npm <command>` -> `bun run <command>`
- `docker compose exec neems-api <command>` -> (run command in neems-core directory)

## TypeScript Types

**TypeScript types are published as the `@newtown-energy/types` package on GitHub Packages.**

- Import types from `@newtown-energy/types` (e.g., `import type { User } from '@newtown-energy/types'`)
- Types are generated from Rust backend code and published to GitHub Packages (`npm.pkg.github.com`) from the neems-core repository
- The `.npmrc` file routes the `@newtown-energy` scope to GitHub Packages
- To update types in CI/production, bump the `@newtown-energy/types` version in `package.json`
- NEVER vendor or manually create type definitions that duplicate the npm package

**Authentication for GitHub Packages:** GitHub Packages requires authentication even for public packages. For local development (outside Docker), set the `GITHUB_PACKAGES_TOKEN` environment variable. The easiest method uses the `gh` CLI:
```bash
gh auth refresh -s read:packages  # One-time: add read:packages scope
export GITHUB_PACKAGES_TOKEN=$(gh auth token)
```
You can add the export to your shell profile or use `direnv` with a `.envrc` file (see `env.example`). Alternatively, create a PAT manually at https://github.com/settings/tokens with `read:packages` scope. CI authentication is handled automatically via `GITHUB_TOKEN`.

**Local development (Docker):** The neems-core container automatically generates types into `local-types/` at the project root. The neems-react container's `docker-entrypoint.sh` uses `bun link` to symlink `node_modules/@newtown-energy/types` to the shared `local-types/` directory, so `import type { ... } from '@newtown-energy/types'` resolves to the locally-built types. Changes to Rust structs with `#[ts(export)]` are picked up automatically via `cargo watch`. The host IDE also resolves to `local-types/` via `tsconfig.app.json` `paths`, falling back to the published package when `local-types/` doesn't exist.

## Project Structure

```
neems-react/
  src/
    components/        # Reusable React components
      Sidebar/         # Navigation sidebar
      UserProfile/     # User profile component
      ...
    pages/             # Page-level components (routes)
      AdminPage.tsx    # User/Site/Company management
      SchedulerPage.tsx # Scheduler interface
      LoginPage/       # Authentication
      ...
    types/
      auth.ts          # Auth-related type re-exports from @newtown-energy/types
    utils/
      api.ts           # API client utilities
    styles/            # SCSS styles
    App.tsx            # Main application component
    main.tsx           # Application entry point
  test/                # Test suites
  public/              # Static assets
  package.json         # Dependencies and scripts
  vite.config.ts       # Vite configuration
  tsconfig.json        # TypeScript configuration
```

## API Integration

### API Client (`src/utils/api.ts`)

The project uses a centralized API client. **Use `apiRequestWithMapping` for all API calls** — it is the standard helper and handles every endpoint pattern in the codebase.

- **`apiRequestWithMapping<T>(url, options, queryOptions)`** — Standard helper. Maps legacy lowercase endpoints (e.g. `/api/1/users`) to OData equivalents (`/api/1/Users`) and unwraps OData collection envelopes for GET requests automatically. Falls through to the basic request behavior for non-collection endpoints (auth, alarms, etc.), so it is safe for everything.
- **`apiRequest<T>(url, options)`** — Lower-level: raw fetch with JSON parsing and error handling. Use only if you specifically need to bypass URL mapping and OData unwrapping.
- **`apiRequestOData<T>(url, options, queryOptions)`** — Lower-level: returns `{ data, count }` for collection endpoints. Use only when you need the OData `@odata.count` alongside the data.

### OData Support

The API supports OData query options:
```typescript
const queryOptions: ODataQueryOptions = {
  $select: 'id,name,email',     // Select specific fields
  $filter: "startswith(email,'admin')", // Filter results
  $orderby: 'name desc',        // Sort results
  $top: 50,                     // Limit results
  $skip: 0,                     // Pagination offset
  $count: true,                 // Include total count
  $expand: 'Company,Roles'      // Include related entities
};
```

### API Patterns

**Fetching Collections:**
```typescript
const users = await apiRequestWithMapping<User[]>('/api/1/Users', {}, queryOptions);
```

**Creating Resources:**
```typescript
await apiRequestWithMapping('/api/1/Users', {
  method: 'POST',
  body: JSON.stringify(requestBody)
});
```

**Updating Resources:**
```typescript
await apiRequestWithMapping(`/api/1/Users/${userId}`, {
  method: 'PUT',
  body: JSON.stringify(updateData)
});
```

**Deleting Resources:**
```typescript
await apiRequestWithMapping(`/api/1/Users/${userId}`, {
  method: 'DELETE'
});
```

### API Endpoints

Common endpoints (automatically mapped to OData format):
- `/api/1/Users` -> `/api/1/Users` (OData collection)
- `/api/1/Sites` -> `/api/1/Sites` (OData collection)
- `/api/1/Companies` -> `/api/1/Companies` (OData collection)
- `/api/1/Companies/{id}/Users` -> Navigation property
- `/api/1/Companies/{id}/Sites` -> Navigation property

### Error Handling

```typescript
try {
  const data = await apiRequestWithMapping<User[]>('/api/1/Users');
  // Handle success
} catch (err) {
  if (err instanceof ApiError) {
    // err.status - HTTP status code
    // err.message - Error message from backend
    console.error(`API Error: ${err.message}`);
  }
}
```

## Component Patterns

### Page Components

All page components should:
1. Export a default React component
2. Optionally export a `pageConfig` for navigation:
```typescript
export const pageConfig = {
  id: 'unique-id',
  title: 'Page Title',
  icon: MaterialUIIcon
};
```

### State Management

- Use React hooks (`useState`, `useEffect`, `useContext`)
- Authentication state is managed via `useAuth()` hook from `pages/LoginPage/useAuth`
- No global state management library (Redux, etc.) currently used

### Component Example

```typescript
import React, { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { apiRequestWithMapping } from '../utils/api';
import type { User } from '@newtown-energy/types';

const MyComponent: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequestWithMapping<User[]>('/api/1/Users');
      setUsers(data);
    } catch (err) {
      setError('Failed to load users');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h2">Users</Typography>
      {/* Component content */}
    </Box>
  );
};

export default MyComponent;
```

## Routing

Routes are defined in `src/App.tsx`:

```typescript
<Routes>
  <Route path="/" element={<OverviewPage />} />
  <Route path="/admin" element={<AdminPage />} />
  <Route path="/scheduler" element={<SchedulerPage />} />
  {/* Add new routes here */}
</Routes>
```

To add a new page:
1. Create component in `src/pages/NewPage.tsx`
2. Add route in `App.tsx`
3. Add navigation item in `Sidebar.tsx` (if needed)

## Styling

### Material-UI Theming

Components use MUI's `sx` prop for styling:
```typescript
<Box sx={{ p: 3, display: 'flex', gap: 2 }}>
  <Button variant="contained" color="primary">Click Me</Button>
</Box>
```

### SCSS Styles

Global styles are in `src/styles/`:
- `App.scss` - Main application styles
- `_colors.scss` - Color variables

Import styles in components:
```typescript
import './styles/MyComponent.scss';
```

## Authentication

Authentication is handled via:
- `src/pages/LoginPage/LoginPage.tsx` - Login UI
- `src/pages/LoginPage/useAuth.ts` - Authentication hook

The `useAuth()` hook provides:
```typescript
const {
  loading,           // Boolean: auth check in progress
  isAuthenticated,   // Boolean: user is logged in
  setIsAuthenticated, // Function: update auth state
  userEmail,         // String: user's email
  userInfo,          // Object: user details with roles
  saveUserInfo,      // Function: save user info
  logout             // Function: log out user
} = useAuth();
```

User roles:
- `staff` - Basic user
- `admin` - Company administrator
- `newtown-admin` - Super administrator
- `newtown-staff` - Newtown staff member

## Schedule System Architecture

The backend supports a sophisticated scheduling system with the following entities:

### Schedule Library Items

Library items are reusable schedule definitions that can be applied to days:
- Each library item contains a list of **commands** with execution offsets
- Library items are associated with **application rules** that determine when they apply
- Application rules support default, day-of-week, and specific-date patterns

### Schedule Commands

Commands define battery operations at specific time offsets:
- **`execution_offset_seconds`**: Seconds from midnight (0-86399)
- **`command_type`**: One of `"charge"`, `"discharge"`, `"trickle_charge"`
- **`id`**: Unique identifier for the command
- Constraint: Commands should not overlap in time (24-hour limit for UI)

### Generated Types (Available)

Available from `@newtown-energy/types`:

- `ScheduleLibraryItem` - Library item with embedded commands
- `ScheduleCommandDto` - Individual battery command
- `CommandType` - Enum: `"charge" | "discharge" | "trickle_charge"`
- `ApplicationRule` - Rule determining when a schedule applies
- `RuleType` - Enum: `"default" | "day_of_week" | "specific_date"`
- `CreateLibraryItemRequest` - Request payload for creating library items
- `UpdateLibraryItemRequest` - Request payload for updating library items
- `CloneLibraryItemRequest` - Request payload for cloning library items
- `CreateApplicationRuleRequest` - Request payload for creating rules
- `EffectiveScheduleResponse` - Response with effective schedule for a date
- `CalendarDaySchedule` - Calendar day schedule assignment

### API Patterns for Schedules

**Library Items:**
```typescript
// Get all library items for a site
const items = await apiRequestWithMapping<ScheduleLibraryItem[]>(
  `/api/1/Sites/${siteId}/ScheduleLibraryItems`
);

// Create a new library item
const newItem = await apiRequestWithMapping<ScheduleLibraryItem>(
  `/api/1/Sites/${siteId}/ScheduleLibraryItems`,
  {
    method: 'POST',
    body: JSON.stringify({ name, description, commands })
  }
);

// Update a library item
await apiRequestWithMapping<ScheduleLibraryItem>(
  `/api/1/ScheduleLibraryItems/${itemId}`,
  {
    method: 'PUT',
    body: JSON.stringify({ name, description, commands })
  }
);

// Delete a library item
await apiRequestWithMapping<void>(
  `/api/1/ScheduleLibraryItems/${itemId}`,
  { method: 'DELETE' }
);

// Clone a library item
const cloned = await apiRequestWithMapping<ScheduleLibraryItem>(
  `/api/1/ScheduleLibraryItems/${itemId}/Clone`,
  {
    method: 'POST',
    body: JSON.stringify({ new_name })
  }
);
```

**Application Rules:**
```typescript
// Get rules for a library item
const rules = await apiRequestWithMapping<ApplicationRule[]>(
  `/api/1/ScheduleLibraryItems/${itemId}/ApplicationRules`
);

// Get all rules for a site
const allRules = await apiRequestWithMapping<ApplicationRule[]>(
  `/api/1/Sites/${siteId}/ApplicationRules`
);

// Create an application rule
const rule = await apiRequestWithMapping<ApplicationRule>(
  `/api/1/ScheduleLibraryItems/${itemId}/ApplicationRules`,
  {
    method: 'POST',
    body: JSON.stringify({
      rule_type: 'day_of_week',
      days_of_week: [1, 2, 3, 4, 5],  // Monday-Friday
      specific_dates: null,
      override_reason: null
    })
  }
);

// Delete an application rule
await apiRequestWithMapping<void>(
  `/api/1/ApplicationRules/${ruleId}`,
  { method: 'DELETE' }
);
```

**Schedule Resolution:**
```typescript
// Get effective schedule for a specific date
const effective = await apiRequestWithMapping<EffectiveScheduleResponse>(
  `/api/1/Sites/${siteId}/EffectiveSchedule?date=2025-01-15`
);
// Returns: { library_item, specificity, rule }

// Get calendar schedules for a month
const calendar = await apiRequestWithMapping<Record<string, CalendarDaySchedule>>(
  `/api/1/Sites/${siteId}/CalendarSchedules?year=2025&month=1`
);
// Returns: { "2025-01-15": { library_item_id, library_item_name, specificity, rule_id }, ... }
```

### Helper Functions

**Time Conversion** (`src/utils/scheduleHelpers.ts`):
```typescript
import {
  secondsToTime,           // Convert offset to "HH:MM"
  timeToSeconds,           // Convert hour/minute to offset
  hasTimeConflict,         // Check for duplicate times
  getCommandTypeLabel,     // Get display name
  getCommandTypeColor,     // Get MUI chip color
  formatDaysOfWeek,        // Format day-of-week array
  toISODateString,         // Convert Date to "YYYY-MM-DD"
  formatScheduleDate       // Format date for display
} from '../utils/scheduleHelpers';
```

### Scheduler System Components

The scheduler system consists of three main components:

#### 1. SchedulerPage (Calendar View)
**Location**: `src/pages/SchedulerPage.tsx`

The main scheduler interface with a calendar view showing which schedule applies to each day.

**Features**:
- Site selector dropdown (using SiteSelector component)
- Calendar month view showing daily schedule assignments
- Specificity indicators (default, day-of-week, specific date)
- Click day to view details and **create date-specific overrides**
- "Apply Different Schedule" dialog with override reason field
- Navigation to Library page

**Date Override Creation**:
- **IMPORTANT**: Date-specific overrides can ONLY be created from the calendar view
- Users can specify an optional reason when creating overrides
- Override reasons are displayed when viewing the day details
- Overrides are created as "specific_date" application rules

#### 2. LibraryPage (Schedule Library)
**Location**: `src/pages/LibraryPage.tsx`

Displays the library of reusable schedule templates.

**Features**:
- List of all library items (schedules)
- Expandable view showing commands for each schedule
- Create/edit/delete library items
- View application rules (default, day-of-week, specific dates)
- **CANNOT create date-specific overrides** (only from calendar view)

**Components Used**:
- `ScheduleLibrary` component (`src/components/ScheduleLibrary/`)
- `ApplicationRuleDialog` component (`src/components/ApplicationRuleDialog/`)

#### 3. ApplicationRuleDialog
**Location**: `src/components/ApplicationRuleDialog/ApplicationRuleDialog.tsx`

Dialog for managing application rules for a schedule.

**Supported Rule Types**:
1. **Default Rule**: Makes this schedule the universal default for all unmatched dates
2. **Day-of-Week Rules**: Apply schedule to specific days of the week (recurring)
3. **Specific Date Rules**: View and delete only (creation must happen from calendar view)

**IMPORTANT Architectural Decision**:
- Users can view and delete specific date rules from this dialog
- Users CANNOT create new specific date rules here
- This ensures date overrides are always created in context (from the calendar)
- Keeps the library focused on reusable rules (default and day-of-week)

**Time Format**:
- Stored as `execution_offset_seconds` (0-86399)
- Displayed as HH:MM (00:00 to 23:59)
- Input via hour/minute dropdowns (15-minute increments for minutes)

**Command Types**:
- **Charge** - Green chip with battery icon
- **Discharge** - Orange chip with flash icon
- **Trickle Charge** - Blue chip with power icon

**Validation**:
- No duplicate times (enforced client-side)
- Time must be within 24 hours
- Required: time and command type
- Parameters skipped in current implementation

## Development Workflow

### Before Starting Work

1. Ensure containers are running: `docker compose up -d`
2. Check container status: `docker compose ps`
3. Pull latest changes: `git pull`
4. Install dependencies if needed: `docker compose exec neems-react npm install`

### Development Server

```bash
# Start dev server (runs inside container)
docker compose exec neems-react npm run dev

# Or start all services with logs
docker compose up

# View container logs
docker compose logs -f neems-react
```

The dev server runs on port 5173 (or `NEEMS_REACT_PORT` env var) and proxies `/api` requests to the backend.

### Testing

```bash
# Run E2E tests against a running dev server on localhost:5173
bin/dosh test
# (Puppeteer needs a local Chrome, so tests run on the host even when the dev
# server is in Docker. From ../devenv/ start the dev server with
# `docker compose exec neems-react npm run dev`, then run `bin/dosh test` from
# this directory.)

# Type checking
docker compose exec neems-react npm run lint:tsc  # Docker
bun run lint:tsc  # Without Docker

# Linting
docker compose exec neems-react npm run lint  # Docker
bun run lint:eslint  # Without Docker
```

**Testing Stack:**
- Jest + Puppeteer for E2E browser automation tests only
- No unit tests currently (could use Bun's built-in test runner in future)
- See `test/README.md` for detailed testing information

### Building for Production

```bash
# Build production bundle
docker compose exec neems-react npm run build

# Preview production build
docker compose exec neems-react npm run preview
```

Build output goes to `dist/` directory.

## Code Quality Standards

### TypeScript

- Use strict TypeScript (no `any` types unless absolutely necessary)
- Import types from `@newtown-energy/types` for API entities
- Define local interfaces for component props and state

### React Best Practices

- Use functional components with hooks
- Extract reusable logic into custom hooks
- Keep components focused and single-purpose
- Use TypeScript for prop types

### Error Handling

- Always handle API errors gracefully
- Show user-friendly error messages
- Log errors to console for debugging
- Use Material-UI `Alert` component for error display

### Async Operations

```typescript
const handleSave = async () => {
  setLoading(true);
  setError(null);
  try {
    await apiRequestWithMapping('/api/1/resource', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    // Handle success
  } catch (err) {
    if (err instanceof ApiError) {
      setError(err.message);
    } else {
      setError('An unexpected error occurred');
    }
    console.error('Error:', err);
  } finally {
    setLoading(false);
  }
};
```

## Common Tasks

### Adding a New Page

1. Create page component: `src/pages/NewPage.tsx`
2. Add route in `src/App.tsx`
3. Add sidebar navigation item in `src/components/Sidebar/Sidebar.tsx`
4. Test navigation and authentication

### Working with Types

```typescript
// Import types from npm package
import type { User } from '@newtown-energy/types';
import type { Site } from '@newtown-energy/types';
import type { CommandType } from '@newtown-energy/types';

// Use in component
const [users, setUsers] = useState<User[]>([]);
```

### Adding a New Component

1. Create component file: `src/components/MyComponent/MyComponent.tsx`
2. Add styles if needed: `src/components/MyComponent/MyComponent.scss`
3. Export from component directory
4. Import and use in parent components

## Troubleshooting

### Types Out of Sync

If TypeScript types don't match the API, update the `@newtown-energy/types` package:
```bash
bun update @newtown-energy/types
```

### API Errors

- Check backend is running: `docker compose ps`
- Check backend logs: `docker compose logs neems-api`
- Verify API endpoint exists in backend
- Check network tab in browser dev tools

### Build Errors

```bash
# Clear node_modules and reinstall
docker compose exec neems-react rm -rf node_modules
docker compose exec neems-react npm install

# Type check
docker compose exec neems-react npm run lint:tsc

# Clear Vite cache
docker compose exec neems-react rm -rf node_modules/.vite
```

## Additional Resources

- See `README.md` for project description and deployment
- See `test/README.md` for testing documentation
- Material-UI docs: https://mui.com/
- React Router docs: https://reactrouter.com/
- Vite docs: https://vitejs.dev/
- Bun docs: https://bun.sh/docs

## Quick Reference

### With Docker (from ../devenv/)

| Task | Command |
|------|---------|
| Start dev server | `docker compose exec neems-react npm run dev` |
| Type check | `docker compose exec neems-react npm run lint:tsc` |
| Lint code | `docker compose exec neems-react npm run lint` |
| Build production | `docker compose exec neems-react npm run build` |
| Install packages | `docker compose exec neems-react npm install` |
| Update types | `docker compose exec neems-react npm update @newtown-energy/types` |
| View logs | `docker compose logs -f neems-react` |
| Access container | `docker compose exec neems-react bash` |

E2E tests run on the host via `bin/dosh test` (from `neems-react/`) against the dev server above — Puppeteer needs a local Chrome.

### Without Docker (from this directory)

| Task | Command |
|------|---------|
| Start dev server | `bun run dev` |
| Run tests | `bin/dosh test` |
| Type check | `bun run lint:tsc` |
| Lint code | `bun run lint:eslint` |
| Build production | `bun run build` |
| Install packages | `bun install` |

---

**Development Choice:** Use Docker for full-stack development. Use standard Bun commands for frontend-only development.
