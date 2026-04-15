import { useEffect } from 'react';
import { fetchActiveAlarms } from '../../utils/alarmApi';
import type { SldAction } from './sldState';

const POLL_INTERVAL_MS = 10_000;

/**
 * Polls the active alarms API and dispatches UPDATE_ALARMS actions
 * to keep the SLD diagram state in sync with real alarm data.
 * Follows the same polling pattern as AlarmsPage and OverviewPage.
 */
export function useSldAlarms(
  dispatch: React.Dispatch<SldAction>,
  enabled = true,
  pollIntervalMs = POLL_INTERVAL_MS,
): void {
  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    const load = async () => {
      try {
        const response = await fetchActiveAlarms();
        if (mounted) {
          dispatch({ type: 'UPDATE_ALARMS', alarms: response });
        }
      } catch (err) {
        console.error('SLD alarm poll failed:', err);
        if (mounted) {
          dispatch({ type: 'MARK_STALE' });
        }
      }
    };

    load();
    const interval = setInterval(load, pollIntervalMs);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [dispatch, enabled, pollIntervalMs]);
}
