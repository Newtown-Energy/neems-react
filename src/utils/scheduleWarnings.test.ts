/**
 * Unit tests for the schedule warning engine.
 *
 * Pure-logic coverage for [evaluateCommandWarnings] plus a couple of
 * round-trip tests against the localStorage-backed dismissal helpers.
 *
 * Run with `bun test src/utils/scheduleWarnings.test.ts` from the
 * `neems-react` directory (or `bun test` to run every test file).
 *
 * Bun provides a jest-flavored API out of the box, so no extra
 * dependency needs to land in `package.json`.
 */

import { describe, expect, beforeEach, test } from 'bun:test';
import type { Site, ScheduleCommandDto } from '@newtown-energy/types';

// Bun's test environment doesn't expose a DOM, so localStorage isn't
// defined. The dismissal helpers swallow the resulting ReferenceError
// and fall back to in-memory, which would make every dismissal test
// silently no-op. Install a minimal Storage-compatible shim before
// importing the module under test.
if (typeof globalThis.localStorage === 'undefined') {
  const memory = new Map<string, string>();
  const shim: Storage = {
    get length() { return memory.size; },
    clear: () => memory.clear(),
    getItem: (k) => memory.get(k) ?? null,
    key: (i) => Array.from(memory.keys())[i] ?? null,
    removeItem: (k) => { memory.delete(k); },
    setItem: (k, v) => { memory.set(k, String(v)); },
  };
  // @ts-expect-error -- we're installing a polyfill at runtime
  globalThis.localStorage = shim;
}

import {
  dismissWarningPermanently,
  evaluateCommandWarnings,
  filterDismissedWarnings,
  undismissWarning,
} from './scheduleWarnings';

// Minimal in-memory localStorage shim so the helpers can run under
// Bun's test runner (no DOM). Bun ships a `globalThis.localStorage`
// shim already, but we wipe it between tests to keep dismissals
// isolated.
function clearLocalStorage(): void {
  try {
    globalThis.localStorage?.clear?.();
  } catch {
    /* ignore */
  }
}

function makeSite(overrides: Partial<Site> = {}): Site {
  return {
    id: 1,
    name: 'Test Site',
    address: '123 Demo St',
    latitude: 0,
    longitude: 0,
    company_id: 1,
    ramp_duration_seconds: 120,
    power_kw: 5000,
    capacity_kwh: 20000,
    closed_loop_enabled: true,
    off_peak_start_minutes: 0,        // 00:00
    off_peak_end_minutes: 8 * 60,     // 08:00
    peak_revenue_start_minutes: 16 * 60, // 16:00
    peak_revenue_end_minutes: 20 * 60,   // 20:00
    interconnection_max_output_kw: 5000,
    rebound_protection_soc_floor_percent: 2,
    site_variant: 'standard',
    ...overrides,
  };
}

function makeCommand(overrides: Partial<ScheduleCommandDto> = {}): ScheduleCommandDto {
  return {
    id: 100,
    execution_offset_seconds: 4 * 3600, // 04:00 — inside off-peak
    command_type: 'charge',
    duration_seconds: 60 * 60,          // 1h
    target_soc_percent: 100,
    ...overrides,
  };
}

describe('evaluateCommandWarnings — happy paths', () => {
  beforeEach(clearLocalStorage);

  test('charge inside off-peak window has no warnings', () => {
    const warnings = evaluateCommandWarnings(makeCommand(), makeSite());
    expect(warnings).toEqual([]);
  });

  test('discharge inside peak-revenue window has no warnings', () => {
    const cmd = makeCommand({
      command_type: 'discharge',
      execution_offset_seconds: 17 * 3600, // 17:00
      duration_seconds: 60 * 60,           // 1h, well within capacity
    });
    const warnings = evaluateCommandWarnings(cmd, makeSite());
    expect(warnings).toEqual([]);
  });
});

describe('evaluateCommandWarnings — window mismatches', () => {
  beforeEach(clearLocalStorage);

  test('discharge outside peak-revenue window warns (dismissible)', () => {
    const cmd = makeCommand({
      command_type: 'discharge',
      execution_offset_seconds: 12 * 3600, // 12:00 — outside 16-20
      duration_seconds: 60 * 60,
    });
    const warnings = evaluateCommandWarnings(cmd, makeSite());
    const w = warnings.find(x => x.key.includes('discharge-outside-peak-revenue'));
    expect(w).toBeDefined();
    expect(w!.severity).toBe('warning');
    expect(w!.dismissible).toBe(true);
    expect(w!.dismissKey).toBe('schedule.discharge-outside-peak-revenue');
  });

  test('discharge inside off-peak charging window flags the conflict', () => {
    const cmd = makeCommand({
      command_type: 'discharge',
      execution_offset_seconds: 4 * 3600, // 04:00 — inside off-peak
      duration_seconds: 60 * 60,
    });
    const warnings = evaluateCommandWarnings(cmd, makeSite());
    expect(warnings.some(w => w.key.includes('discharge-inside-off-peak'))).toBe(true);
  });

  test('charge outside off-peak window warns', () => {
    const cmd = makeCommand({
      execution_offset_seconds: 12 * 3600, // 12:00 — outside 0-8
    });
    const warnings = evaluateCommandWarnings(cmd, makeSite());
    expect(warnings.some(w => w.key.includes('charge-outside-off-peak'))).toBe(true);
  });
});

describe('evaluateCommandWarnings — hard safety rules', () => {
  beforeEach(clearLocalStorage);

  test('no_grid_charge variant + charge command is a non-dismissible error', () => {
    const cmd = makeCommand();
    const site = makeSite({ site_variant: 'no_grid_charge' });
    const warnings = evaluateCommandWarnings(cmd, site);
    const variant = warnings.find(w => w.key.includes('variant-no-grid-charge'));
    expect(variant).toBeDefined();
    expect(variant!.severity).toBe('error');
    expect(variant!.dismissible).toBe(false);
    expect(variant!.dismissKey).toBeUndefined();
  });

  test('open breakers raise a non-dismissible error regardless of command', () => {
    const cmd = makeCommand();
    const warnings = evaluateCommandWarnings(cmd, makeSite(), {
      openBreakers: ['B-1', 'B-2'],
    });
    const breakerWarning = warnings.find(w => w.key.includes('open-breakers'));
    expect(breakerWarning).toBeDefined();
    expect(breakerWarning!.severity).toBe('error');
    expect(breakerWarning!.dismissible).toBe(false);
    expect(breakerWarning!.message).toContain('B-1');
    expect(breakerWarning!.message).toContain('B-2');
  });

  test('offline megapacks raise a warning listing each device', () => {
    const cmd = makeCommand();
    const warnings = evaluateCommandWarnings(cmd, makeSite(), {
      offlineMegapacks: ['Megapack-A'],
    });
    const mp = warnings.find(w => w.key.includes('megapack-offline'));
    expect(mp).toBeDefined();
    expect(mp!.message).toContain('Megapack-A');
  });

  test('site power above interconnection cap warns on discharge', () => {
    const cmd = makeCommand({
      command_type: 'discharge',
      execution_offset_seconds: 17 * 3600,
      duration_seconds: 60 * 60,
    });
    const site = makeSite({
      power_kw: 6000,
      interconnection_max_output_kw: 5000,
    });
    const warnings = evaluateCommandWarnings(cmd, site);
    expect(warnings.some(w => w.key.includes('interconnection-cap'))).toBe(true);
  });
});

describe('evaluateCommandWarnings — SoC shortfall and curtailment', () => {
  beforeEach(clearLocalStorage);

  test('SoC shortfall is flagged when duration exceeds available runtime', () => {
    // power 5000 kW, capacity 20000 kWh, floor 2%.
    // Usable at 100% SoC: (100-2)%/100 * 20000 = 19_600 kWh
    // Runtime at 5000 kW: 19_600 / 5000 = 3.92 h = 235 min.
    // Request 5h => 300 min => shortfall expected.
    const cmd = makeCommand({
      command_type: 'discharge',
      execution_offset_seconds: 17 * 3600,
      duration_seconds: 5 * 60 * 60,
    });
    const warnings = evaluateCommandWarnings(cmd, makeSite());
    const shortfall = warnings.find(w => w.key.includes('soc-shortfall'));
    expect(shortfall).toBeDefined();
    expect(shortfall!.severity).toBe('warning');
    // The message reports the formula inputs; just sanity-check that
    // the listed kW matches the site power.
    expect(shortfall!.message).toContain('5000 kW');
  });

  test('SoC shortfall respects the context-supplied current SoC', () => {
    // With current_soc = 10%, usable = 8% * 20000 = 1600 kWh,
    // runtime = 1600 / 5000 * 60 ≈ 19.2 min. Any duration > ~20 min
    // should trip the warning.
    const cmd = makeCommand({
      command_type: 'discharge',
      execution_offset_seconds: 17 * 3600,
      duration_seconds: 30 * 60,
    });
    const warnings = evaluateCommandWarnings(cmd, makeSite(), {
      currentSocPercent: 10,
    });
    expect(warnings.some(w => w.key.includes('soc-shortfall'))).toBe(true);
  });

  test('curtailment ceiling below site power warns on discharge', () => {
    const cmd = makeCommand({
      command_type: 'discharge',
      execution_offset_seconds: 17 * 3600,
      duration_seconds: 60 * 60,
    });
    const warnings = evaluateCommandWarnings(cmd, makeSite(), {
      curtailmentCeilingKw: 2500,
    });
    const curt = warnings.find(w => w.key.includes('curtailment-ceiling'));
    expect(curt).toBeDefined();
    expect(curt!.message).toContain('2500');
  });

  test('curtailment ceiling at or above site power does not warn', () => {
    const cmd = makeCommand({
      command_type: 'discharge',
      execution_offset_seconds: 17 * 3600,
      duration_seconds: 60 * 60,
    });
    const warnings = evaluateCommandWarnings(cmd, makeSite(), {
      curtailmentCeilingKw: 6000,
    });
    expect(warnings.find(w => w.key.includes('curtailment-ceiling'))).toBeUndefined();
  });
});

describe('dismiss / undismiss persistence', () => {
  beforeEach(clearLocalStorage);

  test('dismissWarningPermanently drops matching warnings on next eval', () => {
    const cmd = makeCommand({
      command_type: 'discharge',
      execution_offset_seconds: 12 * 3600,
      duration_seconds: 60 * 60,
    });
    const warnings = evaluateCommandWarnings(cmd, makeSite());
    const target = warnings.find(w => w.dismissKey === 'schedule.discharge-outside-peak-revenue');
    expect(target).toBeDefined();

    dismissWarningPermanently('schedule.discharge-outside-peak-revenue');
    const survivors = filterDismissedWarnings(warnings);
    expect(survivors.find(w => w.dismissKey === 'schedule.discharge-outside-peak-revenue'))
      .toBeUndefined();
  });

  test('undismissWarning restores a previously-silenced key', () => {
    dismissWarningPermanently('schedule.discharge-outside-peak-revenue');
    undismissWarning('schedule.discharge-outside-peak-revenue');

    const cmd = makeCommand({
      command_type: 'discharge',
      execution_offset_seconds: 12 * 3600,
      duration_seconds: 60 * 60,
    });
    const warnings = evaluateCommandWarnings(cmd, makeSite());
    const survivors = filterDismissedWarnings(warnings);
    expect(survivors.some(w => w.dismissKey === 'schedule.discharge-outside-peak-revenue'))
      .toBe(true);
  });

  test('hard errors without a dismissKey are unaffected by dismissals', () => {
    dismissWarningPermanently('schedule.does-not-exist');
    const cmd = makeCommand();
    const site = makeSite({ site_variant: 'no_grid_charge' });
    const warnings = evaluateCommandWarnings(cmd, site);
    const survivors = filterDismissedWarnings(warnings);
    expect(survivors.some(w => w.key.includes('variant-no-grid-charge'))).toBe(true);
  });
});
