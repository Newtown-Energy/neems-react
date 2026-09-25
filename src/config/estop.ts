// The site's physical E-stop.
//
// The E-stop is a button on site. Nothing in this interface can press it or
// clear it; the RTAC reports its state as alarm 104, and that is all the UI
// ever knows about it. What an operator *can* send from here is an emergency
// shutdown request (see utils/emergencyShutdownApi.ts), which is a different
// thing and is never read as the E-stop's state.

/**
 * Alarm number the RTAC raises while the site's E-stop is tripped.
 *
 * Mirrors `ESTOP_ALARM_NUM` in neems-data's `rtac::alarm_definitions`. This is
 * the only thing that decides whether the site is tripped — the UI never
 * authors that state.
 */
export const ESTOP_ALARM_NUM = 104;
