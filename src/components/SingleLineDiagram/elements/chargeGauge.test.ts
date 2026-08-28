/**
 * Unit tests for the Megapack charge gauge geometry.
 *
 * Run with `bun test src/components/SingleLineDiagram/elements/chargeGauge.test.ts`.
 */

import { describe, expect, test } from 'bun:test';
import { gaugeFill, gaugeGeometry } from './chargeGauge';

// Matches the Megapack body.
const GEOMETRY = gaugeGeometry(40, 54);

describe('gaugeGeometry', () => {
  test('keeps the track clear of the right-hand fan column', () => {
    // Fans sit at x = w/2 - 6 = 14; the track must not reach them.
    expect(GEOMETRY.x + GEOMETRY.width).toBeLessThan(14 - 2.2);
  });

  test('keeps the track inside the body', () => {
    expect(GEOMETRY.x).toBeGreaterThan(-40 / 2);
    expect(GEOMETRY.y).toBeGreaterThan(-54 / 2);
    expect(GEOMETRY.y + GEOMETRY.height).toBeLessThan(54 / 2);
  });
});

describe('gaugeFill', () => {
  test('draws nothing when there is no reading', () => {
    // An empty track and an empty pack are opposite claims, so a missing
    // reading draws no gauge at all.
    expect(gaugeFill(null, GEOMETRY)).toBeNull();
    expect(gaugeFill(undefined, GEOMETRY)).toBeNull();
    expect(gaugeFill(NaN, GEOMETRY)).toBeNull();
  });

  test('draws a zero-height fill for a real zero', () => {
    // Distinct from the case above: the pack answered, and it is empty.
    const fill = gaugeFill(0, GEOMETRY);
    expect(fill).not.toBeNull();
    expect(fill!.height).toBe(0);
  });

  test('fills from the bottom', () => {
    const half = gaugeFill(50, GEOMETRY)!;
    const full = gaugeFill(100, GEOMETRY)!;
    const bottom = GEOMETRY.y + GEOMETRY.height;

    // Both end at the same baseline; only the top edge moves.
    expect(half.y + half.height).toBeCloseTo(full.y + full.height, 5);
    expect(half.y).toBeGreaterThan(full.y);
    expect(half.y + half.height).toBeLessThan(bottom);
  });

  test('is proportional to charge', () => {
    const quarter = gaugeFill(25, GEOMETRY)!;
    const half = gaugeFill(50, GEOMETRY)!;
    expect(half.height).toBeCloseTo(quarter.height * 2, 5);
  });

  test('never paints outside the track', () => {
    // Out-of-range values are clamped: painting past the border would read as
    // a rendering fault rather than the data fault it is.
    for (const soc of [-10, 0, 50, 100, 150]) {
      const fill = gaugeFill(soc, GEOMETRY)!;
      expect(fill.y).toBeGreaterThanOrEqual(GEOMETRY.y);
      expect(fill.y + fill.height).toBeLessThanOrEqual(GEOMETRY.y + GEOMETRY.height);
      expect(fill.x).toBeGreaterThanOrEqual(GEOMETRY.x);
      expect(fill.x + fill.width).toBeLessThanOrEqual(GEOMETRY.x + GEOMETRY.width);
    }
  });

  test('leaves a visible border at full charge', () => {
    // The track outline has to stay readable, or a full pack looks like a
    // solid block rather than a gauge.
    const full = gaugeFill(100, GEOMETRY)!;
    expect(full.height).toBeLessThan(GEOMETRY.height);
    expect(full.width).toBeLessThan(GEOMETRY.width);
  });
});
