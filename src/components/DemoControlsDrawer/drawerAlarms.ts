/**
 * Which demo alarms are the drawer's to list, raise and reset.
 *
 * Since control readbacks moved into the site's alarm state, the demo's active
 * alarm set includes breaker and switch positions: a closed feeder is alarm 607
 * (`ac_breaker_closed`) set. Those are positions, driven by clicks on the
 * diagram, not alarms staged from the drawer — listing them there presents a
 * breaker as a forced alarm, and a Reset that lowers "every forced alarm" opens
 * every breaker the operator closed.
 */

import type { SiteControlDto } from '@newtown-energy/types';

import { ESTOP_ALARM_NUM } from '../../config/estop';

/**
 * Alarm points that are equipment positions the diagram owns.
 *
 * A readback counts only when its control can be opened and closed from the
 * diagram. The lockout relay is deliberately left out: it is trip-only and has
 * no diagram control, so the drawer is the one place a demo can trip it, and
 * its point stays an alarm the drawer can raise and clear.
 */
export function positionAlarmNums(controls: readonly SiteControlDto[]): Set<number> {
  const out = new Set<number>();
  for (const control of controls) {
    if (control.readback_alarm_num == null) continue;
    // Both, as the rule says: a one-way control cannot put the equipment back
    // from the diagram, so its point stays the drawer's to raise and clear.
    if (control.actions.includes('open') && control.actions.includes('close')) {
      out.add(control.readback_alarm_num);
    }
  }
  return out;
}

/** The active demo alarms the drawer lists and resets: all of them but positions. */
export function drawerAlarmNums(
  active: readonly number[],
  positions: ReadonlySet<number>,
): number[] {
  return active.filter((num) => !positions.has(num));
}

/**
 * The alarms shown as chips in the generic list: the drawer's alarms without
 * the E-stop, which has its own section with its own reset. Listing it twice
 * would offer two different-looking ways to do one thing.
 */
export function listedAlarmNums(drawerAlarms: readonly number[]): number[] {
  return drawerAlarms.filter((num) => num !== ESTOP_ALARM_NUM);
}

/**
 * What the drawer's Reset lowers: its alarms, plus the E-stop whenever the site
 * is tripped — so Reset returns the demo to normal however the trip arrived.
 *
 * The explicit add matters for a trip that arrived in seeded history: that
 * lives only in a reading, never in the alarm state the drawer's list comes
 * from, so the list alone would leave the site tripped after a Reset.
 */
export function resetAlarmNums(drawerAlarms: readonly number[], estopTripped: boolean): number[] {
  return estopTripped && !drawerAlarms.includes(ESTOP_ALARM_NUM)
    ? [...drawerAlarms, ESTOP_ALARM_NUM]
    : [...drawerAlarms];
}
