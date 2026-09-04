/**
 * Where the equipment actually is, according to the site.
 *
 * The diagram used to draw switch positions from whatever the operator last
 * clicked, which asserted a state nobody had confirmed. These derive position
 * from the read-only points the RTAC reports instead — the only authority on
 * where a breaker sits.
 *
 * The awkward part is that `/Alarms/Active` lists only the points that are
 * *set*, so absence is ambiguous: a breaker reports `ac_breaker_closed` when
 * closed and reports nothing when open, which is indistinguishable from a feed
 * that has stopped. Hence [readbackUsable] — every position is `unknown` unless
 * we can show the feed is current. A stale feed rendering as "open" would be a
 * quieter version of the bug this replaces.
 */

import type { SwitchPosition } from './types';

/**
 * How long a reading stays good enough to draw a position from.
 *
 * The collector persists at 1 Hz and the diagram polls every 10s, so a reading
 * older than this means the feed has stopped rather than that it is between
 * ticks. Deliberately not generous: the cost of being wrong is a diagram
 * asserting a breaker position from stale data.
 */
export const MAX_READBACK_AGE_SECONDS = 30;

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
 * Whether a reading is current enough to draw positions from.
 *
 * `null` age means no reading carried alarm data at all — not that the site is
 * quiet. Both that and an over-age reading make every position `unknown`.
 */
export function readbackUsable(
  ageSeconds: number | null | undefined,
  stale: boolean,
): boolean {
  if (stale) return false;
  if (ageSeconds == null) return false;
  return ageSeconds >= 0 && ageSeconds <= MAX_READBACK_AGE_SECONDS;
}

/**
 * The position one control is in, given the points currently set.
 *
 * `unknown` whenever we cannot honestly say: no reading, an old reading, a
 * control with no readback point, or the site reporting its own feedback as
 * irrational.
 */
export function derivePosition(
  controlId: string,
  activeAlarmNums: ReadonlySet<number>,
  usable: boolean,
): SwitchPosition {
  const spec = READBACKS[controlId];
  if (!spec || !usable) return 'unknown';
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
  usable: boolean,
): Record<string, SwitchPosition> {
  const out: Record<string, SwitchPosition> = {};
  for (const controlId of Object.keys(READBACKS)) {
    out[controlId] = derivePosition(controlId, activeAlarmNums, usable);
  }
  return out;
}
