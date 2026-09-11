/**
 * Unit tests for which demo alarms the drawer lists and resets.
 *
 * Run with `bun test src/components/DemoControlsDrawer/drawerAlarms.test.ts`.
 */

import { describe, expect, test } from 'bun:test';
import type { SiteControlDto } from '@newtown-energy/types';

import { drawerAlarmNums, positionAlarmNums } from './drawerAlarms';

function control(id: string, actions: string[], readback: number | null): SiteControlDto {
  return {
    id,
    label: id,
    actions,
    readback_alarm_num: readback,
    writable: false,
    latest_request: null,
  };
}

// Mirrors the Newtown table: two line switches and a feeder that open and
// close from the diagram, and the trip-only lockout relay that does not.
const CONTROLS = [
  control('switch-89l-1', ['open', 'close'], 101),
  control('switch-89l-2', ['open', 'close'], 102),
  control('feeder-1a', ['open', 'close'], 607),
  control('lockout-relay', ['trip'], 103),
];

describe('positionAlarmNums', () => {
  test('switch and breaker readbacks are positions', () => {
    const positions = positionAlarmNums(CONTROLS);
    expect(positions.has(101)).toBe(true);
    expect(positions.has(102)).toBe(true);
    expect(positions.has(607)).toBe(true);
  });

  // The drawer is the only place a demo can trip the lockout relay, so its
  // point has to stay an alarm the drawer can raise and clear.
  test('the trip-only lockout relay is not a position', () => {
    expect(positionAlarmNums(CONTROLS).has(103)).toBe(false);
  });

  // The rule is open *and* close. A one-way control cannot put its equipment
  // back from the diagram, so the drawer keeps its point as an alarm.
  test('a one-way control is not a position', () => {
    const positions = positionAlarmNums([
      control('open-only', ['open'], 701),
      control('close-only', ['close'], 702),
    ]);
    expect(positions.size).toBe(0);
  });

  test('a control with no readback contributes nothing', () => {
    expect(positionAlarmNums([control('x', ['open', 'close'], null)]).size).toBe(0);
  });
});

describe('drawerAlarmNums', () => {
  // The bug this fixes: a closed feeder listed as a forced alarm, and Reset
  // lowering it — opening the breaker.
  test('leaves positions out of the list, and so out of Reset', () => {
    const active = [607, 667, 401];
    const positions = positionAlarmNums([
      ...CONTROLS,
      control('feeder-1c', ['open', 'close'], 667),
    ]);
    expect(drawerAlarmNums(active, positions)).toEqual([401]);
  });

  // The E-stop is not a control, so a demo trip stays in the drawer — it is how
  // a trip is reset there.
  test('keeps real alarms, the E-stop and the lockout among them', () => {
    const positions = positionAlarmNums(CONTROLS);
    expect(drawerAlarmNums([104, 103, 101, 401], positions)).toEqual([104, 103, 401]);
  });

  // Controls not loaded (or failed to load): nothing is excluded, which is the
  // old behaviour rather than a list with alarms silently missing.
  test('with no controls known, everything is listed', () => {
    expect(drawerAlarmNums([607, 104], new Set())).toEqual([607, 104]);
  });
});
