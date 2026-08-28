/**
 * Unit tests for the SLD reducer's analog routing: zone -> component,
 * spreadsheet field -> display slot, and the null-vs-zero distinction the
 * gauges depend on.
 *
 * Run with `bun test src/components/SingleLineDiagram/sldAnalogs.test.ts`.
 */

import { describe, expect, test } from 'bun:test';
import type { AnalogPointValue, LatestAnalogsResponse, ZoneAnalogs } from '@newtown-energy/types';
import { sldReducer, createInitialState, defComponent } from './sldState';

function makeState() {
  return createInitialState(
    [
      defComponent('site', 'Site'),
      defComponent('meter-main', 'Meter', undefined, ['Meter']),
      defComponent('megapack-1a', 'Mp1a', undefined, ['MP-1A']),
      defComponent('megapack-2c', 'Mp2c', undefined, ['MP-2C']),
    ],
    [],
  );
}

function point(name: string, value: number | null, unit: string | null): AnalogPointValue {
  return { name, offset: 0, address: 0, raw: 0, value, unit };
}

function zone(partial: Partial<ZoneAnalogs> = {}): ZoneAnalogs {
  return {
    state_of_energy: 46.25,
    ac_voltage: 478.5,
    max_battery_temperature: 28.2,
    points: [],
    ...partial,
  };
}

function response(zones: LatestAnalogsResponse['zones']): LatestAnalogsResponse {
  return { site_id: 1, timestamp: '2026-08-28T14:50:14', zones };
}

describe('UPDATE_ANALOGS', () => {
  test('maps spreadsheet field names onto the slots the elements read', () => {
    const state = sldReducer(makeState(), {
      type: 'UPDATE_ANALOGS',
      analogs: response({ Mp1a: zone() }),
    });

    const analogs = state.components['megapack-1a'].analogs;
    expect(analogs?.soc).toBe(46.25);
    expect(analogs?.stackTemp).toBe(28.2);
    expect(analogs?.outputVoltage).toBe(478.5);
  });

  test('routes each zone to the component that declares it', () => {
    const state = sldReducer(makeState(), {
      type: 'UPDATE_ANALOGS',
      analogs: response({
        Mp1a: zone({ state_of_energy: 10 }),
        Mp2c: zone({ state_of_energy: 90 }),
      }),
    });

    expect(state.components['megapack-1a'].analogs?.soc).toBe(10);
    expect(state.components['megapack-2c'].analogs?.soc).toBe(90);
    // A component in an unrelated zone must not pick up a neighbour's values.
    expect(state.components['meter-main'].analogs).toBeUndefined();
  });

  test('carries a missing reading through as null, never as zero', () => {
    // A gauge at 0% and a gauge with no reading are opposite claims. This is
    // the whole reason the slots are nullable.
    const state = sldReducer(makeState(), {
      type: 'UPDATE_ANALOGS',
      analogs: response({ Mp1a: zone({ state_of_energy: null }) }),
    });

    const analogs = state.components['megapack-1a'].analogs;
    expect(analogs?.soc).toBeNull();
    expect(Object.hasOwn(analogs!, 'soc')).toBe(true);
  });

  test('exposes the rest of the block under its spreadsheet name', () => {
    const state = sldReducer(makeState(), {
      type: 'UPDATE_ANALOGS',
      analogs: response({
        Mp1a: zone({
          points: [
            point('real_power_output', -50, 'kW'),
            point('ambient_temperature', 25, 'C'),
            point('AI_spare_1', null, null),
          ],
        }),
      }),
    });

    const analogs = state.components['megapack-1a'].analogs;
    expect(analogs?.real_power_output).toBe(-50);
    expect(analogs?.ambient_temperature).toBe(25);
    // A spare has no interpretation, so it arrives as null rather than 0.
    expect(analogs?.AI_spare_1).toBeNull();
  });

  test('does not let a block point overwrite the named slots', () => {
    // `state_of_energy` appears both as a top-level field and in `points`.
    // The named slot must win, or the slot and the gauge could disagree.
    const state = sldReducer(makeState(), {
      type: 'UPDATE_ANALOGS',
      analogs: response({
        Mp1a: zone({
          state_of_energy: 46.25,
          points: [point('state_of_energy', 99, '%')],
        }),
      }),
    });

    expect(state.components['megapack-1a'].analogs?.soc).toBe(46.25);
    expect(state.components['megapack-1a'].analogs?.state_of_energy).toBeUndefined();
  });

  test('ignores a zone the diagram does not draw', () => {
    // The API reports the site, not this layout; an unknown zone is not an
    // error and must not throw.
    const state = sldReducer(makeState(), {
      type: 'UPDATE_ANALOGS',
      analogs: response({ Transformer1: zone() }),
    });
    expect(state.components['megapack-1a'].analogs).toBeUndefined();
  });

  test('leaves alarm state untouched', () => {
    // The two polls are independent; an analog update must not reset the
    // status an alarm poll just set.
    const base = makeState();
    base.components['megapack-1a'] = {
      ...base.components['megapack-1a'],
      status: 'alarm',
      activeAlarmCount: 2,
    };
    const state = sldReducer(base, {
      type: 'UPDATE_ANALOGS',
      analogs: response({ Mp1a: zone() }),
    });

    expect(state.components['megapack-1a'].status).toBe('alarm');
    expect(state.components['megapack-1a'].activeAlarmCount).toBe(2);
  });
});
