/**
 * Unit tests for deriving equipment position from the site's readback points.
 *
 * The property being pinned down throughout is that the diagram never asserts a
 * position it cannot source. Every path that loses confidence — a stale feed,
 * no feed, a control with no readback, or the site calling its own feedback
 * irrational — has to land on `unknown` rather than on a position that happens
 * to be the falsy default.
 *
 * Run with `bun test src/components/SingleLineDiagram/readbackPositions.test.ts`.
 */

import { describe, expect, test } from 'bun:test';

import {
  MAX_READBACK_AGE_SECONDS,
  derivePosition,
  derivePositions,
  readbackUsable,
} from './readbackPositions';

const fresh = (nums: number[]) => derivePositions(new Set(nums), true);

describe('readbackUsable', () => {
  test('a current reading is usable', () => {
    expect(readbackUsable(0, false)).toBe(true);
    expect(readbackUsable(MAX_READBACK_AGE_SECONDS, false)).toBe(true);
  });

  // The failure this guards: the collector stops, the last reading ages, and
  // the diagram keeps drawing the positions it happened to see last.
  test('an aged-out reading is not usable', () => {
    expect(readbackUsable(MAX_READBACK_AGE_SECONDS + 1, false)).toBe(false);
  });

  // `null` means no reading carried alarm data at all — not that the site is
  // quiet, which is exactly the conflation that would draw every breaker open.
  test('an absent reading is not usable', () => {
    expect(readbackUsable(null, false)).toBe(false);
    expect(readbackUsable(undefined, false)).toBe(false);
  });

  test('a failed poll is not usable however fresh the last age looked', () => {
    expect(readbackUsable(0, true)).toBe(false);
  });
});

describe('derivePosition', () => {
  // The two halves of the site read in opposite directions, which is the thing
  // most likely to be got backwards: line switches report *open*, feeder
  // breakers report *closed*.
  test('a line switch reports open when its point is set', () => {
    expect(derivePosition('switch-89l-1', new Set([101]), true)).toBe('open');
    expect(derivePosition('switch-89l-1', new Set([]), true)).toBe('closed');
  });

  test('a feeder breaker reports closed when its point is set', () => {
    expect(derivePosition('feeder-1a', new Set([607]), true)).toBe('closed');
    expect(derivePosition('feeder-1a', new Set([]), true)).toBe('open');
  });

  test('the lockout relay reads as tripped when 86-M1 is set', () => {
    expect(derivePosition('lockout-relay', new Set([103]), true)).toBe('open');
    expect(derivePosition('lockout-relay', new Set([]), true)).toBe('closed');
  });

  // Each control reads its own point and no one else's.
  test('one breaker being closed says nothing about its neighbour', () => {
    const positions = fresh([607]);
    expect(positions['feeder-1a']).toBe('closed');
    expect(positions['feeder-1b']).toBe('open');
  });

  // The site telling us its own feedback contradicts itself is a reason to draw
  // nothing, not a reason to pick one.
  test('irrational feedback yields unknown, even with the position point set', () => {
    expect(derivePosition('feeder-1a', new Set([607, 615]), true)).toBe('unknown');
    expect(derivePosition('feeder-1a', new Set([615]), true)).toBe('unknown');
  });

  test('an unusable feed makes every position unknown', () => {
    const positions = derivePositions(new Set([607, 101]), false);
    for (const [id, position] of Object.entries(positions)) {
      expect(position, `${id} must not be drawn from an unusable feed`).toBe('unknown');
    }
  });

  test('a control with no readback point is unknown, not assumed', () => {
    expect(derivePosition('breaker-main', new Set([]), true)).toBe('unknown');
  });

  // Every control the backend offers must be covered here; a missing entry
  // would silently render as unknown forever.
  test('every interactable element has a readback', () => {
    const positions = fresh([]);
    for (const id of [
      'switch-89l-1',
      'switch-89l-2',
      'lockout-relay',
      'feeder-1a',
      'feeder-1b',
      'feeder-1c',
      'feeder-2a',
      'feeder-2b',
      'feeder-2c',
    ]) {
      expect(positions[id], `${id} has no readback entry`).not.toBe(undefined);
      expect(positions[id]).not.toBe('unknown');
    }
  });
});
