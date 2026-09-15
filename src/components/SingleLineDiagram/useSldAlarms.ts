import { useCallback, useEffect, useRef } from 'react';
import { fetchActiveAlarms } from '../../utils/alarmApi';
import { errorLog } from '../../utils/debug';
import { createPollSequence } from '../../utils/pollSequence';
import type { SldAction } from './sldState';

const POLL_INTERVAL_MS = 10_000;

/**
 * Polls the active alarms API and dispatches UPDATE_ALARMS actions
 * to keep the SLD diagram state in sync with real alarm data.
 * Follows the same polling pattern as AlarmsPage and OverviewPage.
 *
 * Returns a `refetch` function so callers (e.g. the Acknowledge button) can
 * force an immediate refresh rather than waiting for the next poll tick. It
 * resolves to whether it *published* — a caller waiting on fresh positions
 * (see [useSiteControls]) must not treat a reached-the-network-and-failed poll,
 * or one discarded as stale, as an update to the diagram.
 *
 * Only the most recently *issued* poll may publish its result (see
 * [createPollSequence]). Polls overlap — one every 10s, plus any `refetch` —
 * and a late `MARK_STALE` would otherwise raise the stale-data emergency over
 * data that is in fact current.
 */
export function useSldAlarms(
  dispatch: React.Dispatch<SldAction>,
  enabled = true,
  pollIntervalMs = POLL_INTERVAL_MS,
): { refetch: () => Promise<boolean> } {
  const mountedRef = useRef(true);
  const sequence = useRef(createPollSequence());

  const load = useCallback(async () => {
    const isLatest = sequence.current.begin();
    const current = () => mountedRef.current && isLatest();
    try {
      const response = await fetchActiveAlarms();
      if (!current()) return false;
      dispatch({ type: 'UPDATE_ALARMS', alarms: response });
      return true;
    } catch (err) {
      errorLog('SLD alarm poll failed:', err);
      if (current()) {
        dispatch({ type: 'MARK_STALE' });
      }
      // Marking the diagram stale is not an update to it: what it draws is
      // still the last thing that landed.
      return false;
    }
  }, [dispatch]);

  useEffect(() => {
    if (!enabled) return;

    mountedRef.current = true;
    load();
    const interval = setInterval(load, pollIntervalMs);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [enabled, pollIntervalMs, load]);

  return { refetch: load };
}
