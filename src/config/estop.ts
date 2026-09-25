// The site's physical E-stop.
//
// The E-stop is a button on site. Nothing in this interface can press it or
// clear it; the RTAC reports its state as an alarm, and that is all the UI ever
// knows about it. What an operator *can* send from here is an emergency
// shutdown request (see utils/emergencyShutdownApi.ts), which is a different
// thing and is never read as the E-stop's state.

import { activeDesign } from '../designs/active';

/**
 * Alarm number the RTAC raises while the site's E-stop is tripped, in the
 * session's site design (104 for Newtown).
 *
 * This is the only thing that decides whether the site is tripped — the UI
 * never authors that state.
 */
export function estopAlarmNum(): number {
  return activeDesign().alarms.estopAlarmNum;
}
