import { useEffect } from 'react';
import { fetchLatestAnalogs } from '../../utils/analogApi';
import { errorLog } from '../../utils/debug';
import type { SldAction } from './sldState';

const POLL_INTERVAL_MS = 10_000;

/**
 * Polls the latest per-zone analog values and dispatches UPDATE_ANALOGS to
 * keep the diagram's gauges in sync. Runs on the same 10s cadence as
 * `useSldAlarms`, because the two poll the same site and there is no reason
 * for the gauges and the alarms to disagree about how current they are.
 *
 * Failure handling is deliberately *not* the same as `useSldAlarms`, which
 * dispatches MARK_STALE. A failed poll here leaves the last values on screen:
 * the diagram already has one staleness signal, driven by the alarm poll, and
 * that is what tells an operator the picture is old. Blanking the gauges would
 * instead claim the packs reported nothing, which is a different and untrue
 * statement.
 *
 * Cancellation is per effect run rather than a shared mounted flag. A shared
 * flag cannot express "this response is for the site we just left" — cleanup
 * clears it and the next run immediately sets it again, so a request in flight
 * for the previous site still dispatches and paints its values onto the new
 * one. A flag scoped to the run that started the request cannot be revived by
 * a later run, so a late response is dropped rather than shown against the
 * wrong site.
 */
export function useSldAnalogs(
  dispatch: React.Dispatch<SldAction>,
  siteId: number | null,
  pollIntervalMs = POLL_INTERVAL_MS,
): void {
  useEffect(() => {
    if (siteId == null) return;

    let cancelled = false;

    const load = async () => {
      try {
        const analogs = await fetchLatestAnalogs(siteId);
        if (!cancelled) {
          dispatch({ type: 'UPDATE_ANALOGS', analogs });
        }
      } catch (err) {
        errorLog('SLD analog poll failed:', err);
      }
    };

    load();
    const interval = setInterval(load, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [dispatch, siteId, pollIntervalMs]);
}
