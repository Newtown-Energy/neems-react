/**
 * Unit tests for the SLD reducer's alarm routing: token-based targeting,
 * message plumbing, zone fallback, and the main-pane border state.
 *
 * Run with `bun test src/components/SingleLineDiagram/sldState.test.ts`.
 */

import { describe, expect, test } from 'bun:test';
import type { ActiveAlarmDto, ActiveAlarmsResponse } from '@newtown-energy/types';
import { sldReducer, createInitialState, defComponent } from './sldState';

function makeState() {
  return createInitialState(
    [
      defComponent('site', 'Site'),
      defComponent('meter-main', 'Meter', undefined, ['Meter']),
      defComponent('breaker-main', 'BreakerRelay', undefined, ['Relay']),
      defComponent('switch-89l-1', 'BreakerRelay', 'closed', ['52-MAIN-1']),
      defComponent('switch-89l-2', 'BreakerRelay', 'closed', ['52-MAIN-2']),
      defComponent('lockout-relay', 'BreakerRelay', 'closed', ['LOR']),
      defComponent('fire-alarm-panel', 'Facp', undefined, ['FACP']),
      defComponent('megapack-1a', 'Mp1a', undefined, ['MP-1A']),
      defComponent('tesla-site-controller', 'TeslaSiteController'),
      defComponent('feeder-1a', 'TeslaSiteController', 'closed'),
    ],
    [],
  );
}

function alarm(partial: Partial<ActiveAlarmDto> & Pick<ActiveAlarmDto, 'alarm_num' | 'zone'>): ActiveAlarmDto {
  return {
    name: 'test_alarm',
    severity: 'Warning',
    message: null,
    sld_targets: [],
    ...partial,
  };
}

function response(alarms: ActiveAlarmDto[]): ActiveAlarmsResponse {
  return {
    alarms,
    has_critical: false,
    has_emergency: false,
    timestamp: '2026-06-19T00:00:00Z',
    data_age_seconds: 0,
  };
}

function apply(alarms: ActiveAlarmDto[]) {
  return sldReducer(makeState(), { type: 'UPDATE_ALARMS', alarms: response(alarms) });
}

describe('sldReducer alarm routing', () => {
  test('routes by SLD-object token, not just zone', () => {
    // A BreakerRelay-zone alarm targeting 52-MAIN-1 must land on the switch
    // only — NOT on every BreakerRelay component (breaker-main, lockout, etc.).
    const state = apply([
      alarm({ alarm_num: 101, zone: 'BreakerRelay', sld_targets: ['52-MAIN-1'] }),
    ]);
    expect(state.components['switch-89l-1'].activeAlarmCount).toBe(1);
    expect(state.components['breaker-main'].activeAlarmCount).toBe(0);
    expect(state.components['switch-89l-2'].activeAlarmCount).toBe(0);
    expect(state.components['lockout-relay'].activeAlarmCount).toBe(0);
  });

  test('relay alarms hit only the relay element', () => {
    const state = apply([
      alarm({ alarm_num: 107, zone: 'BreakerRelay', sld_targets: ['Relay'] }),
    ]);
    expect(state.components['breaker-main'].activeAlarmCount).toBe(1);
    expect(state.components['switch-89l-1'].activeAlarmCount).toBe(0);
  });

  test('carries the operator message onto the active alarm', () => {
    const state = apply([
      alarm({ alarm_num: 101, zone: 'BreakerRelay', sld_targets: ['52-MAIN-1'], message: '89L1 Open' }),
    ]);
    expect(state.components['switch-89l-1'].activeAlarms[0].message).toBe('89L1 Open');
  });

  test('falls back to zone matching when no token maps to a component', () => {
    // M1/M2 have no element yet — a Tesla alarm targeting M1 should still light
    // up the TeslaSiteController-zone components.
    const state = apply([
      alarm({ alarm_num: 501, zone: 'TeslaSiteController', sld_targets: ['M1'] }),
    ]);
    expect(state.components['tesla-site-controller'].activeAlarmCount).toBe(1);
    expect(state.components['feeder-1a'].activeAlarmCount).toBe(1);
  });

  test('a Border-targeted alarm colors the frame by its severity', () => {
    // A critical controls fault paints the frame in its own severity color
    // (critical), not an unintuitive fixed blue.
    const state = apply([
      alarm({ alarm_num: 103, zone: 'BreakerRelay', severity: 'Critical', sld_targets: ['LOR', 'Border'] }),
    ]);
    expect(state.border).toEqual({ severity: 'Critical' });
    // The non-Border token still routes to the lockout relay.
    expect(state.components['lockout-relay'].activeAlarmCount).toBe(1);
  });

  test('a non-fire emergency does not raise the frame', () => {
    // An Emergency outside the fire alarm panel zone with no Border target must
    // NOT paint the frame — it still lights its own element, but no border.
    const state = apply([
      alarm({ alarm_num: 601, zone: 'Mp1a', severity: 'Emergency', sld_targets: ['MP-1A'] }),
    ]);
    expect(state.border).toBeNull();
    expect(state.components['megapack-1a'].activeAlarmCount).toBe(1);
  });

  test('a Border-only alarm sets the frame without lighting components', () => {
    // Targeting only 'Border' is a site-level frame signal; it must not spill
    // onto every component sharing the alarm's zone.
    const state = apply([
      alarm({ alarm_num: 103, zone: 'BreakerRelay', severity: 'Critical', sld_targets: ['Border'] }),
    ]);
    expect(state.border).toEqual({ severity: 'Critical' });
    expect(state.components['breaker-main'].activeAlarmCount).toBe(0);
    expect(state.components['switch-89l-1'].activeAlarmCount).toBe(0);
    expect(state.components['lockout-relay'].activeAlarmCount).toBe(0);
  });

  test('the frame takes the highest severity among triggering alarms', () => {
    // A fire emergency (FACP zone) plus a critical controls fault → the frame
    // shows the most severe (emergency) color.
    const state = apply([
      alarm({ alarm_num: 401, zone: 'Facp', severity: 'Emergency', sld_targets: ['FACP'], message: 'FIRE!!' }),
      alarm({ alarm_num: 103, zone: 'BreakerRelay', severity: 'Critical', sld_targets: ['Border'] }),
    ]);
    expect(state.border).toEqual({ severity: 'Emergency' });
    expect(state.components['fire-alarm-panel'].activeAlarms[0].message).toBe('FIRE!!');
  });

  test('no border when nothing targets it and there is no fire emergency', () => {
    const state = apply([
      alarm({ alarm_num: 107, zone: 'BreakerRelay', sld_targets: ['Relay'] }),
    ]);
    expect(state.border).toBeNull();
  });
});
