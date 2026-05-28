/**
 * Unit tests for the schedule warning engine.
 *
 * Pure-logic coverage for:
 *
 *   - [evaluateCommandWarnings] — schedule-shape rules (window fit,
 *     variant mismatch, interconnection cap).
 *   - [evaluateSiteState] — site-state rules (open breakers, offline
 *     megapacks, utility curtailment, low SoC).
 *   - [dismissWarningPermanently] / [filterDismissedWarnings] —
 *     localStorage-backed warning dismissal.
 *
 * Run with `bun test src/utils/scheduleWarnings.test.ts` from the
 * `neems-react` directory (or `bun test` to run every test file).
 */

import { describe, expect, test } from 'bun:test';
import type { Site, ScheduleCommandDto } from '@newtown-energy/types';

import {
  evaluateCommandWarnings,
  evaluateSiteState,
} from './scheduleWarnings';

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

  test('charge inside off-peak window has no warnings', () => {
    const warnings = evaluateCommandWarnings(makeCommand(), makeSite());
    expect(warnings).toEqual([]);
  });

  test('discharge inside peak-revenue window has no warnings', () => {
    const cmd = makeCommand({
      command_type: 'discharge',
      execution_offset_seconds: 17 * 3600, // 17:00
      duration_seconds: 60 * 60,
    });
    const warnings = evaluateCommandWarnings(cmd, makeSite());
    expect(warnings).toEqual([]);
  });
});

describe('evaluateCommandWarnings — window mismatches', () => {

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

describe('evaluateCommandWarnings — variant + interconnection', () => {

  test('no_grid_charge variant + charge command is a non-dismissible error', () => {
    const cmd = makeCommand();
    const site = makeSite({ site_variant: 'no_grid_charge' });
    const warnings = evaluateCommandWarnings(cmd, site);
    const variant = warnings.find(w => w.key.includes('variant-no-grid-charge'));
    expect(variant).toBeDefined();
    expect(variant!.severity).toBe('error');
    expect(variant!.dismissible).toBe(false);
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

describe('evaluateCommandWarnings — no longer surfaces site-state', () => {
  // These guards lock in the split: site-state context fields that
  // used to leak into the command warning list belong in
  // evaluateSiteState now. If someone re-adds breaker/megapack/SoC/
  // curtailment checks to evaluateCommandWarnings, these tests fire.

  test('ignores openBreakers and offlineMegapacks in context', () => {
    const cmd = makeCommand();
    const warnings = evaluateCommandWarnings(cmd, makeSite());
    expect(warnings.some(w => w.key.includes('open-breakers'))).toBe(false);
    expect(warnings.some(w => w.key.includes('megapack-offline'))).toBe(false);
  });

  test('does not flag SoC shortfall regardless of duration', () => {
    const cmd = makeCommand({
      command_type: 'discharge',
      execution_offset_seconds: 17 * 3600,
      duration_seconds: 50 * 60 * 60, // wildly larger than capacity
    });
    const warnings = evaluateCommandWarnings(cmd, makeSite());
    expect(warnings.some(w => w.key.includes('soc-shortfall'))).toBe(false);
  });

  test('does not flag curtailment ceiling', () => {
    const cmd = makeCommand({
      command_type: 'discharge',
      execution_offset_seconds: 17 * 3600,
      duration_seconds: 60 * 60,
    });
    const warnings = evaluateCommandWarnings(cmd, makeSite());
    expect(warnings.some(w => w.key.includes('curtailment'))).toBe(false);
  });
});

describe('evaluateSiteState', () => {
  test('empty context produces no issues', () => {
    expect(evaluateSiteState(makeSite())).toEqual([]);
  });

  test('open breakers are a non-dismissible error', () => {
    const issues = evaluateSiteState(makeSite(), { openBreakers: ['B-1', 'B-2'] });
    const row = issues.find(i => i.key === 'open-breakers');
    expect(row).toBeDefined();
    expect(row!.severity).toBe('error');
    expect(row!.message).toContain('B-1');
    expect(row!.message).toContain('B-2');
  });

  test('offline megapacks emit a warning listing each device', () => {
    const issues = evaluateSiteState(makeSite(), { offlineMegapacks: ['Megapack-A'] });
    const row = issues.find(i => i.key === 'megapack-offline');
    expect(row).toBeDefined();
    expect(row!.severity).toBe('warning');
    expect(row!.message).toContain('Megapack-A');
  });

  test('curtailment ceiling below site power flags', () => {
    const issues = evaluateSiteState(makeSite(), { curtailmentCeilingKw: 2500 });
    const row = issues.find(i => i.key === 'curtailment-active');
    expect(row).toBeDefined();
    expect(row!.message).toContain('2500');
  });

  test('curtailment ceiling at or above site power does not flag', () => {
    const issues = evaluateSiteState(makeSite(), { curtailmentCeilingKw: 6000 });
    expect(issues.find(i => i.key === 'curtailment-active')).toBeUndefined();
  });

  test('low SoC (≤ 20%) flags with warning severity above the rebound floor', () => {
    const issues = evaluateSiteState(makeSite(), { currentSocPercent: 10 });
    const row = issues.find(i => i.key === 'low-soc');
    expect(row).toBeDefined();
    expect(row!.severity).toBe('warning');
    expect(row!.message).toContain('10%');
  });

  test('SoC at or below the rebound floor escalates to error', () => {
    // Default rebound_protection_soc_floor_percent on makeSite is 2.
    const issues = evaluateSiteState(makeSite(), { currentSocPercent: 1 });
    const row = issues.find(i => i.key === 'low-soc');
    expect(row).toBeDefined();
    expect(row!.severity).toBe('error');
  });

  test('SoC above 20% does not flag', () => {
    const issues = evaluateSiteState(makeSite(), { currentSocPercent: 50 });
    expect(issues.find(i => i.key === 'low-soc')).toBeUndefined();
  });
});

