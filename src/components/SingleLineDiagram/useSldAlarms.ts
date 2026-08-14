import { useCallback, useEffect, useRef } from 'react';
import { fetchActiveAlarms } from '../../utils/alarmApi';
import { errorLog } from '../../utils/debug';
import type { SldAction } from './sldState';

const POLL_INTERVAL_MS = 10_000;

/**
 * Polls the active alarms API and dispatches UPDATE_ALARMS actions
 * to keep the SLD diagram state in sync with real alarm data.
 * Follows the same polling pattern as AlarmsPage and OverviewPage.
 *
 * Returns a `refetch` function so callers (e.g. the Acknowledge button) can
 * force an immediate refresh rather than waiting for the next poll tick.
 */
export function useSldAlarms(
  dispatch: React.Dispatch<SldAction>,
  enabled = true,
  pollIntervalMs = POLL_INTERVAL_MS,
): { refetch: () => Promise<void> } {
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const response = await fetchActiveAlarms();
      if (mountedRef.current) {
        dispatch({ type: 'UPDATE_ALARMS', alarms: response });
      }
    } catch (err) {
      errorLog('SLD alarm poll failed:', err);
      if (mountedRef.current) {
        dispatch({ type: 'MARK_STALE' });
      }
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
