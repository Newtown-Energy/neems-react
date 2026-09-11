/**
 * Unit tests for the app-wide alarm-feed banners.
 *
 * The property pinned throughout: stale site data is raised at the same
 * severity as an emergency alarm, on every page, for every way the data can
 * stop being current.
 *
 * Run with `bun test src/components/SiteStatePanel/alarmFeedAlerts.test.ts`.
 */

import { describe, expect, test } from 'bun:test';
import type { ActiveAlarmDto, ActiveAlarmsResponse } from '@newtown-energy/types';

import { STALE_AFTER_SECONDS } from '../../utils/staleness';
import { alarmFeedAlerts, alarmSeverityAlert } from './alarmFeedAlerts';

function status(overrides: Partial<ActiveAlarmsResponse> = {}): ActiveAlarmsResponse {
  return {
    alarms: [],
    has_critical: false,
    has_emergency: false,
    timestamp: '2026-09-11T00:00:00Z',
    data_age_seconds: 0,
    ...overrides,
  };
}

function alarmDto(partial: Partial<ActiveAlarmDto>): ActiveAlarmDto {
  return {
    alarm_num: 104,
    zone: 'BreakerRelay',
    name: 'estop',
    severity: 'Critical',
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

const keys = (s: ActiveAlarmsResponse | null, unreachable = false) =>
  alarmFeedAlerts(s, unreachable).map((a) => a.key);

describe('alarmFeedAlerts', () => {
  test('a current, quiet feed raises nothing', () => {
    expect(alarmFeedAlerts(status(), false)).toEqual([]);
  });

  test('stale data is an error, not a warning', () => {
    const [alert] = alarmFeedAlerts(status({ data_age_seconds: STALE_AFTER_SECONDS + 1 }), false);
    expect(alert.key).toBe('stale-alarm-data');
    expect(alert.severity).toBe('error');
    expect(alert.message).toContain(`${STALE_AFTER_SECONDS + 1} seconds old`);
  });

  test('a site that has never reported is an error', () => {
    const [alert] = alarmFeedAlerts(status({ data_age_seconds: null, timestamp: null }), false);
    expect(alert.key).toBe('no-site-data');
    expect(alert.severity).toBe('error');
  });

  test('an unreachable service is an error, and supersedes the age', () => {
    const alerts = alarmFeedAlerts(status({ data_age_seconds: 3600 }), true);
    expect(alerts.map((a) => a.key)).toEqual(['alarm-service-unreachable']);
    expect(alerts[0].severity).toBe('error');
  });

  // Not knowing yet is different from knowing there is nothing: the banner
  // must not announce "no data from the site" for the instant before the
  // first poll answers.
  test('says nothing before the first poll has answered', () => {
    expect(alarmFeedAlerts(null, false)).toEqual([]);
  });

  test('an unreachable service is reported even before any poll succeeded', () => {
    expect(keys(null, true)).toEqual(['alarm-service-unreachable']);
  });

  // The first poll can fail before anything has arrived. Then there is no
  // "last thing the site reported", and the banner must not claim there is.
  test('unreachable before any reading does not claim a last reported state', () => {
    const [alert] = alarmFeedAlerts(null, true);
    expect(alert.message).toContain('nothing has been received');
    expect(alert.message).not.toContain('last thing the site reported');
  });

  // The last sentence is the instruction, so it is the one that must be there.
  test('every stale banner ends by saying how far the screen can be trusted', () => {
    const held = 'the last thing the site reported and may no longer be true.';
    const nothing = "Nothing on screen reflects the site's current state.";
    const cases: [ActiveAlarmsResponse | null, boolean, string][] = [
      [status({ data_age_seconds: STALE_AFTER_SECONDS + 1 }), false, held],
      [status({ data_age_seconds: 5 }), true, held],
      [status({ data_age_seconds: null, timestamp: null }), false, nothing],
      [null, true, nothing],
    ];
    for (const [s, unreachable, ending] of cases) {
      const [alert] = alarmFeedAlerts(s, unreachable);
      expect(alert.message.endsWith(ending), alert.message).toBe(true);
    }
  });

  // A known emergency was real as of the last successful poll, so it stays
  // visible alongside the staleness that qualifies it.
  test('stale data and an emergency alarm are both reported', () => {
    expect(
      keys(status({ data_age_seconds: STALE_AFTER_SECONDS + 1, has_emergency: true })),
    ).toEqual(['stale-alarm-data', 'emergency-alarms']);
  });
});

describe('alarmFeedAlerts with the demo bypass', () => {
  // Just past the threshold, where the bypass has to start working.
  const stale = status({ data_age_seconds: STALE_AFTER_SECONDS + 1 });

  test('suppresses the stale-data banner', () => {
    expect(alarmFeedAlerts(stale, false, true)).toEqual([]);
  });

  test('turning it off shows it again', () => {
    expect(keys(stale)).toEqual(['stale-alarm-data']);
  });

  test('never suppresses an unreachable service', () => {
    expect(alarmFeedAlerts(stale, true, true).map((a) => a.key)).toEqual([
      'alarm-service-unreachable',
    ]);
  });

  test('never suppresses a site that has sent nothing', () => {
    const empty = status({ data_age_seconds: null, timestamp: null });
    expect(alarmFeedAlerts(empty, false, true).map((a) => a.key)).toEqual(['no-site-data']);
  });

  // The bypass is about the feed's age; the alarms it carries are still real
  // demo alarms and must still be announced.
  test('leaves emergency and critical alarms alone', () => {
    const withEmergency = status({ data_age_seconds: STALE_AFTER_SECONDS + 1, has_emergency: true });
    expect(alarmFeedAlerts(withEmergency, false, true).map((a) => a.key)).toEqual([
      'emergency-alarms',
    ]);

    // A separate branch from the emergency one, so it needs its own case.
    const withCritical = status({ data_age_seconds: STALE_AFTER_SECONDS + 1, has_critical: true });
    expect(alarmFeedAlerts(withCritical, false, true).map((a) => a.key)).toEqual([
      'critical-alarms',
    ]);
  });
});

// A latched alarm — returned to normal, still owed an acknowledgement — keeps
// `has_critical` / `has_emergency` true, because the backend counts every
// visible alarm. It still needs an operator, but it is not active.
describe('alarmFeedAlerts wording for latched alarms', () => {
  const titleFor = (alarms: ActiveAlarmDto[], flags: Partial<ActiveAlarmsResponse>) =>
    alarmFeedAlerts(status({ alarms, ...flags }), false)[0]?.title;

  test('a firing critical is active', () => {
    expect(titleFor([alarmDto({ data_active: true })], { has_critical: true })).toBe(
      'Critical alarms active',
    );
  });

  test('a latched critical needs acknowledgement, and is not called active', () => {
    const alerts = alarmFeedAlerts(
      status({ alarms: [alarmDto({ data_active: false })], has_critical: true }),
      false,
    );
    expect(alerts[0].title).toBe('Critical alarms need acknowledgement');
    expect(alerts[0].message).not.toContain('are active');
  });

  test('one firing critical among latched ones is still active', () => {
    const alarms = [
      alarmDto({ alarm_num: 104, data_active: false }),
      alarmDto({ alarm_num: 105, data_active: true }),
    ];
    expect(titleFor(alarms, { has_critical: true })).toBe('Critical alarms active');
  });

  test('the same distinction holds for emergencies', () => {
    const fire = (data_active: boolean) =>
      alarmDto({ alarm_num: 401, zone: 'Facp', name: 'fire_alarm', severity: 'Emergency', data_active });
    expect(titleFor([fire(true)], { has_emergency: true })).toBe('Emergency alarms active');
    expect(titleFor([fire(false)], { has_emergency: true })).toBe(
      'Emergency alarms need acknowledgement',
    );
  });

  // Only an alarm of *that* severity counts: a firing Info alarm does not make
  // a latched critical active.
  test('a firing alarm of another severity does not make a latched critical active', () => {
    const alarms = [
      alarmDto({ alarm_num: 104, severity: 'Critical', data_active: false }),
      alarmDto({ alarm_num: 667, severity: 'Info', name: 'ac_breaker_closed', data_active: true }),
    ];
    expect(titleFor(alarms, { has_critical: true })).toBe('Critical alarms need acknowledgement');
  });
});

// The Overview page announces this alert through the same helper, so it must
// hold on its own, not only inside the banner list.
describe('alarmSeverityAlert', () => {
  test('is null with no feed, and with no emergency or critical', () => {
    expect(alarmSeverityAlert(null)).toBe(null);
    expect(alarmSeverityAlert(status())).toBe(null);
  });

  test('distinguishes a latched critical from a firing one', () => {
    expect(
      alarmSeverityAlert(status({ alarms: [alarmDto({ data_active: false })], has_critical: true }))
        ?.title,
    ).toBe('Critical alarms need acknowledgement');
    expect(
      alarmSeverityAlert(status({ alarms: [alarmDto({ data_active: true })], has_critical: true }))
        ?.title,
    ).toBe('Critical alarms active');
  });

  test('an emergency outranks a critical', () => {
    const alert = alarmSeverityAlert(
      status({
        alarms: [alarmDto({ severity: 'Emergency', alarm_num: 401, data_active: true })],
        has_emergency: true,
        has_critical: true,
      }),
    );
    expect(alert?.key).toBe('emergency-alarms');
    expect(alert?.severity).toBe('error');
  });
});
