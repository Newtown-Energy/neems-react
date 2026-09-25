/**
 * Unit tests for choosing the frontend's site design from the backend's id.
 *
 * Run with `bun test src/designs/designs.test.ts`.
 */

import { describe, expect, test } from 'bun:test';

import { DESIGNS, designById } from './index';
import { ApiError } from '../utils/api';
import { describeFetchFailure, resolveDesign, retryDelayMs } from './resolveDesign';

describe('designById', () => {
  test('finds a registered design', () => {
    expect(designById('newtown')?.id).toBe('newtown');
  });

  test('an unknown id is undefined, not a default', () => {
    expect(designById('atlantis')).toBeUndefined();
  });

  // The registry is a plain object; inherited keys must not pass for designs.
  test('does not treat inherited properties as designs', () => {
    expect(designById('toString')).toBeUndefined();
    expect(designById('__proto__')).toBeUndefined();
  });

  test('every design is registered under its own id', () => {
    for (const [key, design] of Object.entries(DESIGNS)) {
      expect(design.id).toBe(key);
    }
  });
});

describe('resolveDesign', () => {
  test("resolves the backend's design", () => {
    expect(resolveDesign({ id: 'newtown', estop_alarm_num: 104 }).design?.id).toBe('newtown');
  });

  // Drawing another site's diagram would put switches and alarms in the wrong
  // places with nothing on screen to say so.
  test('an id this build lacks is an error naming it, never a fallback', () => {
    const resolution = resolveDesign({ id: 'atlantis', estop_alarm_num: 104 });
    expect(resolution.design).toBeUndefined();
    expect(resolution.error).toContain('"atlantis"');
    expect(resolution.error).toContain('newtown');
  });
});

describe('resolveDesign against the backend', () => {
  // The diagram's lockout reads the frontend's copy of the E-stop number; the
  // backend's shutdown logic reads its own. They must not quietly differ.
  test('an E-stop number the backend disagrees with is an error', () => {
    const resolution = resolveDesign({ id: 'newtown', estop_alarm_num: 999 });
    expect(resolution.design).toBeUndefined();
    expect(resolution.error).toContain('999');
    expect(resolution.error).toContain('104');
  });
});

describe('describeFetchFailure', () => {
  // A backend without the endpoint is running, just older: telling the
  // operator it is down sends them to fix the wrong thing.
  test('a 404 is reported as a version mismatch, not an outage', () => {
    const notFound = new ApiError('Not Found', 404, new Response(null, { status: 404 }));
    expect(describeFetchFailure(notFound)).toContain('older than this interface');
  });

  test('any other HTTP error names its status, not an outage', () => {
    const serverError = new ApiError('Boom', 500, new Response(null, { status: 500 }));
    const message = describeFetchFailure(serverError);
    expect(message).toContain('HTTP 500');
    expect(message).not.toContain('Could not reach');
  });

  test('a request that never got an answer is reported as unreachable', () => {
    expect(describeFetchFailure(new TypeError('Failed to fetch'))).toContain('Could not reach');
  });
});

describe('retryDelayMs', () => {
  test('backs off from a second, doubling, capped at thirty', () => {
    expect([0, 1, 2, 3, 4, 5, 10].map(retryDelayMs)).toEqual([
      1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000,
    ]);
  });
});

describe('a design is internally consistent', () => {
  for (const design of Object.values(DESIGNS)) {
    test(`${design.id}: every readback names a component the diagram tracks`, () => {
      const ids = new Set(design.diagram.components.map((c) => c.id));
      for (const controlId of Object.keys(design.diagram.readbacks)) {
        expect(ids.has(controlId), `${controlId} is not a component`).toBe(true);
      }
    });

    test(`${design.id}: every wire joins components or buses it names`, () => {
      const ids = new Set(design.diagram.components.map((c) => c.id));
      for (const wire of design.diagram.wires) {
        for (const end of [wire.from, wire.to]) {
          // Buses are drawn by the layout, not tracked as components.
          if (!end.startsWith('bus-')) {
            expect(ids.has(end), `${wire.id} joins unknown ${end}`).toBe(true);
          }
        }
      }
    });
  }
});
