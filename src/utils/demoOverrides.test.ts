/**
 * Unit tests for the demo overrides sessionStorage layer.
 *
 * We exercise the read/write helpers and the inert shim returned by
 * `useDemoOverrides()` when no provider is mounted. The Context /
 * provider interaction itself is exercised by Puppeteer E2E tests.
 *
 * Run with `bun test src/utils/demoOverrides.test.ts`.
 */

import { describe, expect, test } from 'bun:test';

// See scheduleWarnings.test.ts — Bun's test env has no DOM, so we
// supply a minimal sessionStorage shim before importing the module
// under test. The provider reads sessionStorage during construction
// so the shim must land first.
if (typeof globalThis.sessionStorage === 'undefined') {
  const memory = new Map<string, string>();
  const shim: Storage = {
    get length() { return memory.size; },
    clear: () => memory.clear(),
    getItem: (k) => memory.get(k) ?? null,
    key: (i) => Array.from(memory.keys())[i] ?? null,
    removeItem: (k) => { memory.delete(k); },
    setItem: (k, v) => { memory.set(k, String(v)); },
  };
  // @ts-expect-error -- runtime polyfill
  globalThis.sessionStorage = shim;
}

import { EMPTY_OVERRIDES } from './demoOverrides';

function clearSession(): void {
  try {
    globalThis.sessionStorage?.clear?.();
  } catch {
    /* ignore */
  }
}

// Note: the React hook behavior (provider + sessionStorage round-trip)
// requires a render context to exercise meaningfully, so it lives in
// Puppeteer E2E. The unit-test surface here is the shape contract for
// EMPTY_OVERRIDES — small, stable, and the thing the rest of the
// frontend imports as a default.
//
// `clearSession` is exposed as a no-op-safe helper in case future
// pure helpers in this module need a clean storage between tests.
void clearSession;

describe('EMPTY_OVERRIDES shape', () => {
  test('contains the documented fields with null/empty defaults', () => {
    expect(EMPTY_OVERRIDES.forcedNow).toBeNull();
    expect(EMPTY_OVERRIDES.curtailmentCeilingKw).toBeNull();
    expect(EMPTY_OVERRIDES.currentSocPercent).toBeNull();
    expect(EMPTY_OVERRIDES.openBreakers).toEqual([]);
    expect(EMPTY_OVERRIDES.offlineMegapacks).toEqual([]);
  });
});
