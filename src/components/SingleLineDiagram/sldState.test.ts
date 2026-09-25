/**
 * Unit tests for the SLD reducer's alarm routing: token-based targeting,
 * message plumbing, zone fallback, and the main-pane border state.
 *
 * Run with `bun test src/components/SingleLineDiagram/sldState.test.ts`.
 */

import { describe, expect, test } from 'bun:test';
import type { ActiveAlarmDto, ActiveAlarmsResponse } from '@newtown-energy/types';
import { STALE_AFTER_SECONDS } from '../../utils/staleness';
import {
  sldReducer,
  createInitialState,
  defComponent,
  diagramFrame,
  eStopDisplayState,
} from './sldState';

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
    data_active: true,
    acknowledged: false,
    acknowledged_at: null,
    acknowledged_by_user_id: null,
    acknowledged_by_email: null,
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

/** Apply alarms carried by a reading of the given age (`null`: no reading). */
function applyAged(alarms: ActiveAlarmDto[], age: number | null) {
  return sldReducer(makeState(), {
    type: 'UPDATE_ALARMS',
    alarms: { ...response(alarms), data_age_seconds: age, timestamp: age == null ? null : '2026-06-19T00:00:00Z' },
  });
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

  test('carries acknowledgement status and metadata onto the active alarm', () => {
    const state = apply([
      alarm({
        alarm_num: 101,
        zone: 'BreakerRelay',
        sld_targets: ['52-MAIN-1'],
        data_active: true,
        acknowledged: true,
        acknowledged_by_email: 'operator@example.com',
        acknowledged_at: '2026-06-19T01:23:45Z',
      }),
    ]);
    const summary = state.components['switch-89l-1'].activeAlarms[0];
    // Acknowledged and still firing: the two axes travel independently, so an
    // acknowledged alarm must not read as though the condition went away.
    expect(summary.dataActive).toBe(true);
    expect(summary.acknowledged).toBe(true);
    expect(summary.acknowledgedByEmail).toBe('operator@example.com');
    expect(summary.acknowledgedAt).toBe('2026-06-19T01:23:45Z');
  });

  test('plumbs a returned-unacknowledged blip through with data_active=false', () => {
    const state = apply([
      alarm({
        alarm_num: 101,
        zone: 'BreakerRelay',
        sld_targets: ['52-MAIN-1'],
        data_active: false,
        acknowledged: false,
      }),
    ]);
    const summary = state.components['switch-89l-1'].activeAlarms[0];
    // No longer firing, still owed an acknowledgement — the case the latch
    // exists for, so it must survive the mapping intact.
    expect(summary.dataActive).toBe(false);
    expect(summary.acknowledged).toBe(false);
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
    expect(state.border).toEqual({ severity: 'Critical', firing: true });
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
    expect(state.border).toEqual({ severity: 'Critical', firing: true });
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
    expect(state.border).toEqual({ severity: 'Emergency', firing: true });
    expect(state.components['fire-alarm-panel'].activeAlarms[0].message).toBe('FIRE!!');
  });

  test('no border when nothing targets it and there is no fire emergency', () => {
    const state = apply([
      alarm({ alarm_num: 107, zone: 'BreakerRelay', sld_targets: ['Relay'] }),
    ]);
    expect(state.border).toBeNull();
  });
});

describe('sldReducer E-stop mode', () => {
  test('operationalMode follows alarm 104 from the site', () => {
    const state = apply([
      alarm({ alarm_num: 104, zone: 'BreakerRelay', name: 'estop', severity: 'Critical' }),
    ]);
    expect(state.operationalMode).toBe('e-stop-active');
  });

  test('operationalMode stays normal when the site reports no E-stop', () => {
    const state = apply([
      alarm({ alarm_num: 107, zone: 'BreakerRelay', sld_targets: ['Relay'] }),
    ]);
    expect(state.operationalMode).toBe('normal');
  });

  test('operationalMode clears when alarm 104 drops', () => {
    // Cleared at the panel: no client action resets this, the alarm simply
    // stops arriving and the diagram follows.
    const tripped = apply([
      alarm({ alarm_num: 104, zone: 'BreakerRelay', name: 'estop', severity: 'Critical' }),
    ]);
    expect(tripped.operationalMode).toBe('e-stop-active');

    const cleared = sldReducer(tripped, { type: 'UPDATE_ALARMS', alarms: response([]) });
    expect(cleared.operationalMode).toBe('normal');
  });

  test('an unrelated critical alarm does not read as an E-stop', () => {
    const state = apply([
      alarm({ alarm_num: 401, zone: 'Facp', severity: 'Emergency', sld_targets: ['FACP'] }),
    ]);
    expect(state.operationalMode).toBe('normal');
  });

  test('operationalMode clears when alarm 104 returns to normal unacknowledged', () => {
    // The realistic way a trip ends: reset at the panel, so the site stops
    // reporting 104 — but the alarm stays listed, latched, until somebody
    // acknowledges it. Holding the diagram in e-stop until then would keep the
    // switches drawn locked out and the page saying the site is stopped, long
    // after it started back up. It would also contradict the backend, whose
    // `observed_active` reads the data axis of this same alarm.
    const state = apply([
      alarm({
        alarm_num: 104,
        zone: 'BreakerRelay',
        name: 'estop',
        severity: 'Critical',
        data_active: false,
        acknowledged: false,
      }),
    ]);
    expect(state.operationalMode).toBe('normal');
  });

  test('an acknowledged E-stop that is still tripped stays in e-stop', () => {
    // The other axis, and the dangerous direction to get wrong: acknowledging
    // is an operator saying they have seen it, not the plant starting again.
    const state = apply([
      alarm({
        alarm_num: 104,
        zone: 'BreakerRelay',
        name: 'estop',
        severity: 'Critical',
        data_active: true,
        acknowledged: true,
      }),
    ]);
    expect(state.operationalMode).toBe('e-stop-active');
  });
});

describe('eStopDisplayState', () => {
  const trip = alarm({ alarm_num: 104, zone: 'BreakerRelay', name: 'estop', severity: 'Critical' });

  test('is tripped when the site reports alarm 104', () => {
    expect(eStopDisplayState(apply([trip]))).toBe('tripped');
  });

  test('is normal when a reading carries no E-stop', () => {
    expect(eStopDisplayState(apply([]))).toBe('normal');
  });

  // Before the first poll, and with no reading behind a poll, the site has
  // said nothing about the E-stop. "Normal" there would be an all-clear on no
  // evidence.
  test('is unknown before any alarm poll has answered', () => {
    expect(eStopDisplayState(makeState())).toBe('unknown');
  });

  test('is unknown when no reading carried alarm data', () => {
    expect(eStopDisplayState(applyAged([], null))).toBe('unknown');
  });

  test('a reported trip is never hidden as unknown', () => {
    expect(eStopDisplayState(applyAged([trip], null))).toBe('tripped');
  });

  // An old "clear" is not current evidence of one. The indicator falls back to
  // unknown exactly where the diagram frame calls the data stale.
  test('is unknown when the last poll failed', () => {
    expect(eStopDisplayState({ ...apply([]), dataStale: true })).toBe('unknown');
  });

  test('is unknown when the reading has gone stale', () => {
    expect(eStopDisplayState(applyAged([], 60 * 60))).toBe('unknown');
  });

  test('the demo bypass forgives an old reading, not a failed poll', () => {
    expect(eStopDisplayState(applyAged([], 60 * 60), true)).toBe('normal');
    expect(eStopDisplayState({ ...apply([]), dataStale: true }, true)).toBe('unknown');
  });
});

describe('sldReducer readback positions', () => {
  // A latched alarm is the normal state of a readback point that has moved,
  // not an edge case: every open/close cycle leaves one behind. These pin that
  // the position follows the data axis and ignores the acknowledgement axis.

  test('a point that is set reports its position', () => {
    // 101 (bps_89l1_open) means open when set.
    const state = apply([
      alarm({ alarm_num: 101, zone: 'BreakerRelay', sld_targets: ['52-MAIN-1'] }),
    ]);
    expect(state.components['switch-89l-1'].switchPosition).toBe('open');
  });

  test('a returned-unacknowledged readback reports the new position', () => {
    // 89L-1 was opened and closed again. The alarm is still listed because
    // nobody has acknowledged it, but the site is no longer reporting the
    // switch as open — so the diagram must draw it closed. Drawing it open
    // would assert a position the equipment has already left, which is the
    // failure the readback rewrite existed to prevent.
    const state = apply([
      alarm({
        alarm_num: 101,
        zone: 'BreakerRelay',
        sld_targets: ['52-MAIN-1'],
        data_active: false,
        acknowledged: false,
      }),
    ]);
    expect(state.components['switch-89l-1'].switchPosition).toBe('closed');
  });

  test('acknowledging is not what moves a switch', () => {
    // The mirror of the case above: still firing, now acknowledged. An
    // acknowledgement says an operator has seen it, and says nothing about
    // where the switch is.
    const state = apply([
      alarm({
        alarm_num: 101,
        zone: 'BreakerRelay',
        sld_targets: ['52-MAIN-1'],
        data_active: true,
        acknowledged: true,
      }),
    ]);
    expect(state.components['switch-89l-1'].switchPosition).toBe('open');
  });

  test('the same rule holds for a point that reads the other way round', () => {
    // 607 (ac_breaker_closed) means *closed* when set, so a latched-but-
    // cleared 607 must read open — the opposite direction from 101, from the
    // identical input.
    const firing = apply([alarm({ alarm_num: 607, zone: 'Mp1a', sld_targets: ['MP-1A'] })]);
    expect(firing.components['feeder-1a'].switchPosition).toBe('closed');

    const latched = apply([
      alarm({ alarm_num: 607, zone: 'Mp1a', sld_targets: ['MP-1A'], data_active: false }),
    ]);
    expect(latched.components['feeder-1a'].switchPosition).toBe('open');
  });

  test('the alarm stays visible on the element whose position moved on', () => {
    // The fix must not be "stop listing the alarm". A cleared-but-
    // unacknowledged alarm is still owed an acknowledgement and still belongs
    // on the element; only the position stops following it.
    const state = apply([
      alarm({
        alarm_num: 101,
        zone: 'BreakerRelay',
        sld_targets: ['52-MAIN-1'],
        data_active: false,
        acknowledged: false,
      }),
    ]);
    const component = state.components['switch-89l-1'];
    expect(component.switchPosition).toBe('closed');
    expect(component.activeAlarmCount).toBe(1);
    expect(component.activeAlarms[0].dataActive).toBe(false);
  });
});

describe('sldReducer stale data', () => {
  const switchOpen = alarm({ alarm_num: 101, zone: 'BreakerRelay', sld_targets: ['52-MAIN-1'] });

  // The behavior this replaces blanked every position to `unknown` once the
  // reading aged past 30s. Stale data now holds the last reported position and
  // raises the emergency frame instead.
  test('an old reading still draws the position the site last reported', () => {
    const state = applyAged([switchOpen], STALE_AFTER_SECONDS * 100);
    expect(state.components['switch-89l-1'].switchPosition).toBe('open');
    expect(state.components['feeder-1a'].switchPosition).toBe('open');
  });

  test('a failed poll holds every position rather than blanking it', () => {
    const before = apply([switchOpen]);
    const after = sldReducer(before, { type: 'MARK_STALE' });
    expect(after.components['switch-89l-1'].switchPosition).toBe('open');
    expect(after.dataStale).toBe(true);
  });

  // The layout seeds these controls `closed`, but a readback-driven position
  // comes from a reading and from nothing else. Before this, a first poll that
  // failed left the seed on screen as though the site had reported it.
  test('readback-driven controls start unknown, whatever the layout seeded', () => {
    const state = makeState();
    expect(state.components['switch-89l-1'].switchPosition).toBe('unknown');
    expect(state.components['feeder-1a'].switchPosition).toBe('unknown');
    expect(state.components['lockout-relay'].switchPosition).toBe('unknown');
  });

  test('a first poll that fails leaves positions unknown, not seeded', () => {
    const state = sldReducer(makeState(), { type: 'MARK_STALE' });
    expect(state.components['switch-89l-1'].switchPosition).toBe('unknown');
    expect(state.components['feeder-1a'].switchPosition).toBe('unknown');
  });

  // Nothing to hold: no reading has ever arrived.
  test('with no reading at all, positions are unknown', () => {
    const state = applyAged([], null);
    expect(state.components['switch-89l-1'].switchPosition).toBe('unknown');
    expect(state.components['feeder-1a'].switchPosition).toBe('unknown');
  });
});

describe('diagramFrame', () => {
  test('nothing is raised before the first poll has answered', () => {
    // Initial state has no reading, which would otherwise read as "no data"
    // and flash the frame for the instant before the first poll lands.
    expect(diagramFrame(makeState())).toBe(null);
  });

  test('a current reading with no site-level alarm raises nothing', () => {
    expect(diagramFrame(apply([]))).toBe(null);
  });

  test('stale data raises the frame at Emergency', () => {
    const frame = diagramFrame(applyAged([], STALE_AFTER_SECONDS + 1));
    expect(frame?.severity).toBe('Emergency');
    expect(frame?.announcement).toContain('stale');
  });

  test('no data from the site raises the frame at Emergency', () => {
    expect(diagramFrame(applyAged([], null))?.severity).toBe('Emergency');
  });

  test('an unreachable service raises the frame at Emergency', () => {
    const frame = diagramFrame(sldReducer(apply([]), { type: 'MARK_STALE' }));
    expect(frame?.severity).toBe('Emergency');
    expect(frame?.announcement).toContain('unreachable');
    expect(frame?.announcement).toContain('last state the site reported');
  });

  // With no earlier reading there is no last state to be showing, and the
  // announcement must not claim one.
  test('unreachable before any reading does not claim a last reported state', () => {
    const frame = diagramFrame(sldReducer(makeState(), { type: 'MARK_STALE' }));
    expect(frame?.severity).toBe('Emergency');
    expect(frame?.announcement).toContain('nothing has been received');
    expect(frame?.announcement).not.toContain('last state');
  });

  // Staleness qualifies everything on screen, including whichever alarm frame
  // the last reading would have raised.
  test('stale data outranks a site-level alarm frame', () => {
    const borderWarning = alarm({ alarm_num: 3, zone: 'Site', sld_targets: ['Border'] });
    const fresh = apply([borderWarning]);
    expect(diagramFrame(fresh)?.severity).toBe('Warning');

    const stale = applyAged([borderWarning], STALE_AFTER_SECONDS + 1);
    expect(diagramFrame(stale)?.severity).toBe('Emergency');
  });
});

describe('diagramFrame with the demo bypass', () => {
  test('an old reading raises no frame', () => {
    expect(diagramFrame(applyAged([], STALE_AFTER_SECONDS + 1), true)).toBe(null);
  });

  test('a site-level alarm frame still shows through', () => {
    const borderWarning = alarm({ alarm_num: 3, zone: 'Site', sld_targets: ['Border'] });
    const frame = diagramFrame(applyAged([borderWarning], STALE_AFTER_SECONDS + 1), true);
    expect(frame?.severity).toBe('Warning');
  });

  test('an unreachable service still raises the emergency frame', () => {
    const frame = diagramFrame(sldReducer(apply([]), { type: 'MARK_STALE' }), true);
    expect(frame?.severity).toBe('Emergency');
  });

  test('no data at all still raises the emergency frame', () => {
    expect(diagramFrame(applyAged([], null), true)?.severity).toBe('Emergency');
  });
});

// A latched alarm — returned to normal, still owed an acknowledgement — still
// raises the frame, because it needs an operator. It must not be announced as
// active, because the site says it has cleared.
describe('diagramFrame wording for latched alarms', () => {
  const estop = (data_active: boolean) =>
    alarm({
      alarm_num: 104,
      zone: 'BreakerRelay',
      name: 'estop',
      severity: 'Critical',
      sld_targets: ['Estop', 'Border'],
      data_active,
    });

  test('a firing site-level alarm is announced as active', () => {
    const frame = diagramFrame(apply([estop(true)]));
    expect(frame?.severity).toBe('Critical');
    expect(frame?.announcement).toBe('Site-level critical alarm active');
  });

  test('a latched site-level alarm still raises the frame, announced as needing acknowledgement', () => {
    const frame = diagramFrame(apply([estop(false)]));
    expect(frame?.severity).toBe('Critical');
    expect(frame?.announcement).toBe('Site-level critical alarm needs acknowledgement');
  });

  test('one firing alarm at the frame severity makes it active', () => {
    const other = alarm({
      alarm_num: 3,
      zone: 'Site',
      severity: 'Critical',
      sld_targets: ['Border'],
      data_active: true,
    });
    expect(diagramFrame(apply([estop(false), other]))?.announcement).toBe(
      'Site-level critical alarm active',
    );
  });

  // The frame takes the highest severity; what it announces is whether *that*
  // severity is firing. A firing warning does not make a latched critical active.
  test('a firing lower-severity alarm does not make a latched higher one active', () => {
    const warning = alarm({ alarm_num: 3, zone: 'Site', severity: 'Warning', sld_targets: ['Border'] });
    const frame = diagramFrame(apply([estop(false), warning]));
    expect(frame?.severity).toBe('Critical');
    expect(frame?.announcement).toBe('Site-level critical alarm needs acknowledgement');
  });
});
