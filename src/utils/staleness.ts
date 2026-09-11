/**
 * When the picture on screen stops being the site's current state.
 *
 * One definition for the whole app. The diagram and the app-wide banner used to
 * decide this separately — the diagram at 30s, the banner at 60s — which left a
 * half-minute where the diagram went grey and nothing said why. Anything that
 * asks "is this data current?" asks here.
 *
 * Stale data is treated as an emergency, not a rendering detail: an EMS that
 * has lost its view of the site cannot tell an operator what the site is
 * doing, and has to say so as loudly as it says anything else.
 */

/**
 * How old the newest reading may be before the site's data counts as stale.
 *
 * The collector persists at 1 Hz and the diagram polls every 10s, so a reading
 * older than this is three missed polls — a feed that has stopped rather than
 * one that is between ticks.
 */
export const STALE_AFTER_SECONDS = 30;

/**
 * Why the site's data is not current. Each reason means the same thing to an
 * operator — do not trust what is on screen — but they are told apart because
 * the remedy differs.
 *
 * - `unreachable`: the alarm service could not be polled at all.
 * - `no-data`: the service answered, and the site has never reported.
 * - `old`: the site's newest reading is older than [STALE_AFTER_SECONDS].
 */
export type StaleReason = 'unreachable' | 'no-data' | 'old';

/**
 * Whether the site's data is current, and if not, why.
 *
 * `null` means current. `ageSeconds` is the alarm feed's `data_age_seconds`,
 * where `null` means no reading carried alarm data at all. A negative age is a
 * reading timestamped slightly ahead of this clock, which is skew rather than
 * staleness.
 *
 * `ignoreAge` is the demo's bypass (the drawer's "Ignore stale data"): the
 * newest reading is treated as current however old it is. It is applied here,
 * and only here, so no caller can bypass one staleness signal and forget
 * another. It bypasses *age* and nothing else:
 *
 * - `unreachable` still reports — that is a demo that is broken, not one that
 *   is staged, and hiding it costs someone an hour at the worst moment.
 * - `no-data` still reports — there is no reading to treat as current, and the
 *   banner is what tells the person running the demo to inject some.
 */
export function staleReason(
  ageSeconds: number | null | undefined,
  unreachable: boolean,
  ignoreAge = false,
): StaleReason | null {
  if (unreachable) return 'unreachable';
  if (ageSeconds == null) return 'no-data';
  if (ignoreAge) return null;
  if (ageSeconds > STALE_AFTER_SECONDS) return 'old';
  return null;
}
