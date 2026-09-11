/**
 * Unit tests for the one definition of stale site data.
 *
 * Run with `bun test src/utils/staleness.test.ts`.
 */

import { describe, expect, test } from 'bun:test';

import { STALE_AFTER_SECONDS, staleReason } from './staleness';

describe('staleReason', () => {
  test('a reading within the threshold is current', () => {
    expect(staleReason(0, false)).toBe(null);
    expect(staleReason(STALE_AFTER_SECONDS, false)).toBe(null);
  });

  test('a reading past the threshold is stale', () => {
    expect(staleReason(STALE_AFTER_SECONDS + 1, false)).toBe('old');
  });

  // `null` age means the site has never reported — not that it is quiet. The
  // conflation this guards against is a healthy-looking screen with nothing
  // behind it.
  test('no reading at all is stale, and says so distinctly', () => {
    expect(staleReason(null, false)).toBe('no-data');
    expect(staleReason(undefined, false)).toBe('no-data');
  });

  // A failed poll means everything on screen is last-known, however fresh the
  // last successful answer looked.
  test('an unreachable service is stale whatever the last age was', () => {
    expect(staleReason(0, true)).toBe('unreachable');
    expect(staleReason(null, true)).toBe('unreachable');
  });

  test('a reading slightly ahead of this clock is skew, not staleness', () => {
    expect(staleReason(-2, false)).toBe(null);
  });
});

describe('staleReason with the demo bypass', () => {
  // At the boundary, so an implementation that only waived very old readings
  // could not pass.
  test('a reading just past the threshold is treated as current', () => {
    expect(staleReason(STALE_AFTER_SECONDS + 1, false, true)).toBe(null);
  });

  // The bypass hides age and nothing else. An unreachable service is a demo
  // that is broken, not one that is staged.
  test('an unreachable service is still reported', () => {
    expect(staleReason(0, true, true)).toBe('unreachable');
  });

  // There is no reading to treat as current, and saying so is what tells the
  // person running the demo to inject history.
  test('no data at all is still reported', () => {
    expect(staleReason(null, false, true)).toBe('no-data');
  });
});
