/**
 * Where the equipment actually is, according to the site.
 *
 * The diagram used to draw switch positions from whatever the operator last
 * clicked, which asserted a state nobody had confirmed. These derive position
 * from the read-only points the RTAC reports instead — the only authority on
 * where a breaker sits.
 *
 * A position is held, not withdrawn, when the feed goes quiet: the diagram keeps
 * drawing the last thing the site reported. What changes is that the whole
 * picture is flagged as stale — as an emergency, see `utils/staleness` — so a
 * held position is never mistaken for a current one. That is how a SCADA
 * display treats a lost feed, and it tells an operator strictly more than a
 * field of question marks would.
 *
 * `unknown` is kept for the cases where there is genuinely nothing to hold: no
 * reading has ever arrived, a control has no readback point, or the site
 * reports its own feedback as irrational.
 *
 * Presence in the alarm list is ambiguous, too: `/Alarms/Active` lists more
 * than the points that are set, because an alarm that has returned to normal
 * stays listed until it is acknowledged. So the caller filters on `data_active`
 * before building the set these read — see [derivePosition].
 */

import { activeDesign } from '../../designs/active';
import type { SwitchPosition } from './types';

/** What a control's readback point means when its bit is set. */
export type WhenActive = 'closed' | 'open';

/**
 * Where one control's position is read from. Each site design lists one per
 * interactable element, mirroring neems-data's `SITE_CONTROLS` for that design.
 *
 * The direction is data rather than a branch because sites disagree: Newtown's
 * line switches report *open*, its feeder breakers report *closed*. Getting one
 * inverted would draw every breaker backwards.
 */
export interface ReadbackSpec {
  /** The point reporting this control's state. */
  alarmNum: number;
  /** The position the control is in when that point is set. */
  whenActive: WhenActive;
  /**
   * A point that reports position feedback contradicting itself. When set, the
   * site is telling us it does not know either — so neither do we.
   */
  irrationalAlarmNum?: number;
}

/**
 * The position one control is in, given the points currently set.
 *
 * `activeAlarmNums` must hold only the points the site is reporting *now* —
 * `/Alarms/Active` also lists points that have returned to normal and are still
 * owed an acknowledgement, and passing those in reports the position the
 * equipment has already left. Filtering on `data_active` is the caller's job
 * because the caller is the one holding the DTOs.
 *
 * `unknown` whenever there is nothing to draw from: no reading has ever arrived
 * (`hasReading` false), the control has no readback point, or the site reports
 * its own feedback as irrational. An *old* reading is not one of these — it is
 * held, and its age is the staleness flag's business, not this function's.
 */
export function derivePosition(
  controlId: string,
  activeAlarmNums: ReadonlySet<number>,
  hasReading: boolean,
): SwitchPosition {
  const spec = activeDesign().diagram.readbacks[controlId];
  if (!spec || !hasReading) return 'unknown';
  if (spec.irrationalAlarmNum != null && activeAlarmNums.has(spec.irrationalAlarmNum)) {
    return 'unknown';
  }

  const set = activeAlarmNums.has(spec.alarmNum);
  if (spec.whenActive === 'closed') return set ? 'closed' : 'open';
  return set ? 'open' : 'closed';
}

/** Every control's position, for folding into diagram state in one pass. */
export function derivePositions(
  activeAlarmNums: ReadonlySet<number>,
  hasReading: boolean,
): Record<string, SwitchPosition> {
  const out: Record<string, SwitchPosition> = {};
  for (const controlId of Object.keys(activeDesign().diagram.readbacks)) {
    out[controlId] = derivePosition(controlId, activeAlarmNums, hasReading);
  }
  return out;
}
