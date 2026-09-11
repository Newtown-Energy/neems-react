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

import type { SwitchPosition } from './types';

/** What a control's readback point means when its bit is set. */
type WhenActive = 'closed' | 'open';

interface ReadbackSpec {
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
 * One entry per interactable element, mirroring neems-data's `SITE_CONTROLS`.
 *
 * Note the two halves read in opposite directions, which is the site's
 * convention rather than ours: the line switches report *open* (101/102
 * `bps_89l_open`), the feeder breakers report *closed* (`ac_breaker_closed`).
 * Getting one inverted would draw every breaker backwards, which is why the
 * direction is data here rather than a branch somewhere.
 */
export const READBACKS: Record<string, ReadbackSpec> = {
  'switch-89l-1': { alarmNum: 101, whenActive: 'open' },
  'switch-89l-2': { alarmNum: 102, whenActive: 'open' },
  // 86-M1 set means the lockout relay has tripped, which the diagram draws as
  // the handle in its open position.
  'lockout-relay': { alarmNum: 103, whenActive: 'open' },
  'feeder-1a': { alarmNum: 607, whenActive: 'closed', irrationalAlarmNum: 615 },
  'feeder-1b': { alarmNum: 637, whenActive: 'closed', irrationalAlarmNum: 645 },
  'feeder-1c': { alarmNum: 667, whenActive: 'closed', irrationalAlarmNum: 675 },
  'feeder-2a': { alarmNum: 697, whenActive: 'closed', irrationalAlarmNum: 705 },
  'feeder-2b': { alarmNum: 727, whenActive: 'closed', irrationalAlarmNum: 735 },
  'feeder-2c': { alarmNum: 757, whenActive: 'closed', irrationalAlarmNum: 765 },
};

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
  const spec = READBACKS[controlId];
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
  for (const controlId of Object.keys(READBACKS)) {
    out[controlId] = derivePosition(controlId, activeAlarmNums, hasReading);
  }
  return out;
}
