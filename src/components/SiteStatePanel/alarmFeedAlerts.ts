/**
 * The alarm-feed half of the app-wide status banner, as a pure function so the
 * rules can be tested without rendering.
 */

import type { ActiveAlarmsResponse } from '@newtown-energy/types';

import { staleReason } from '../../utils/staleness';

export interface BannerAlert {
  key: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

/**
 * Every stale banner ends by saying how far the screen can be trusted, because
 * that sentence is the instruction. Which one depends on whether there is a
 * last reading to be showing at all.
 */
const HELD_STATE =
  'What is on screen is the last thing the site reported and may no longer be true.';
const NOTHING_CURRENT = "Nothing on screen reflects the site's current state.";

/**
 * Banners describing the alarm feed: whether it is current, and whether it is
 * reporting an emergency or critical alarm.
 *
 * Stale data is an `error`, the same severity as an emergency alarm. An
 * operator looking at stale data is looking at a site that may be doing
 * anything, and nothing on screen will tell them so except this.
 *
 * Nothing is said before the first poll has answered (`status` null and not
 * unreachable): not knowing yet is different from knowing there is nothing.
 *
 * `ignoreStaleData` is the demo bypass — see [staleReason] for exactly what it
 * does and does not hide.
 */
export function alarmFeedAlerts(
  status: ActiveAlarmsResponse | null,
  unreachable: boolean,
  ignoreStaleData = false,
): BannerAlert[] {
  const out: BannerAlert[] = [];
  if (status == null && !unreachable) return out;

  const age = status?.data_age_seconds != null ? Number(status.data_age_seconds) : null;
  switch (staleReason(age, unreachable, ignoreStaleData)) {
    case 'unreachable':
      // With no earlier reading there is no "last thing the site reported" —
      // the first poll can fail before any has arrived.
      out.push({
        key: 'alarm-service-unreachable',
        severity: 'error',
        title: 'Alarm service unreachable',
        message:
          age != null
            ? `Unable to reach the alarm service. ${HELD_STATE}`
            : `Unable to reach the alarm service, and nothing has been received from the site. ${NOTHING_CURRENT}`,
      });
      break;
    case 'no-data':
      out.push({
        key: 'no-site-data',
        severity: 'error',
        title: 'No data from the site',
        message:
          'Nothing has been received from the site. The RTAC connection may be down. ' +
          NOTHING_CURRENT,
      });
      break;
    case 'old':
      out.push({
        key: 'stale-alarm-data',
        severity: 'error',
        title: 'Stale site data',
        message:
          `Site data is ${age} seconds old. The RTAC connection may be down. ` + HELD_STATE,
      });
      break;
    case null:
      break;
  }

  // Surface a known emergency/critical even while unreachable — it was real
  // as of the last successful poll.
  const severityAlert = alarmSeverityAlert(status);
  if (severityAlert) out.push(severityAlert);
  return out;
}

/**
 * The emergency-or-critical alert for an alarm feed, or `null` when there is
 * neither. The one place this is decided, so every page that announces it —
 * the app-wide banner, the Overview — says the same thing.
 *
 * `has_emergency` / `has_critical` count every visible alarm, including latched
 * ones: returned to normal and still owed an acknowledgement. Those still need
 * an operator, so they still raise an alert — but they are not *active*, and
 * saying so would tell an operator the condition is present when the site says
 * it has cleared. Which one it is comes from the alarms' own data state, and
 * only alarms of that severity count.
 */
export function alarmSeverityAlert(status: ActiveAlarmsResponse | null): BannerAlert | null {
  const firing = (severity: string) =>
    (status?.alarms ?? []).some((a) => a.severity === severity && a.data_active);
  if (status?.has_emergency) {
    return firing('Emergency')
      ? {
          key: 'emergency-alarms',
          severity: 'error',
          title: 'Emergency alarms active',
          message: 'EMERGENCY alarms are active — immediate action required.',
        }
      : {
          key: 'emergency-alarms',
          severity: 'error',
          title: 'Emergency alarms need acknowledgement',
          message: 'EMERGENCY alarms have returned to normal but have not been acknowledged.',
        };
  }
  if (status?.has_critical) {
    return firing('Critical')
      ? {
          key: 'critical-alarms',
          severity: 'warning',
          title: 'Critical alarms active',
          message: 'Critical alarms are active — attention required.',
        }
      : {
          key: 'critical-alarms',
          severity: 'warning',
          title: 'Critical alarms need acknowledgement',
          message: 'Critical alarms have returned to normal but have not been acknowledged.',
        };
  }
  return null;
}
