/**
 * Unit tests for deriving equipment position from the site's readback points.
 *
 * The property being pinned down throughout is that the diagram never asserts a
 * position it has nothing to source from. A control with no readback, the site
 * calling its own feedback irrational, and no reading ever having arrived all
 * have to land on `unknown` rather than on a position that happens to be the
 * falsy default. An *old* reading is not in that list: it is held, and flagged
 * as stale elsewhere (`utils/staleness`).
 *
 * Run with `bun test src/components/SingleLineDiagram/readbackPositions.test.ts`.
 */

import { describe, expect, test } from 'bun:test';

import { derivePosition, derivePositions } from './readbackPositions';

const fresh = (nums: number[]) => derivePositions(new Set(nums), true);

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

  // No reading ever arrived, so there is nothing to hold — and an empty set
  // must not be read as "every point clear", which would draw the feeders
  // open and the switches closed from nothing at all.
  test('with no reading at all, every position is unknown', () => {
    const positions = derivePositions(new Set([607, 101]), false);
    for (const [id, position] of Object.entries(positions)) {
      expect(position, `${id} must not be drawn without a reading`).toBe('unknown');
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
