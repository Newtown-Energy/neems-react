import { useEffect, useState } from 'react';
import type { ActiveAlarmsResponse } from '@newtown-energy/types';

import { fetchActiveAlarms } from './alarmApi';
import { errorLog } from './debug';
import { createPollSequence } from './pollSequence';

const POLL_INTERVAL_MS = 10_000;

export interface ActiveAlarmStatus {
  /** Latest successful response, or null before the first one. */
  status: ActiveAlarmsResponse | null;
  /** True once a poll has failed — the alarm service can't be reached, so
   *  `status` (if any) is the last-known state and may be outdated. */
  unreachable: boolean;
}

/**
 * Polls `/api/1/Alarms/Active` and returns the latest response plus whether
 * the service is currently unreachable.
 *
 * The page-level views (SLD, Alarms, Overview) each poll active alarms
 * for their own UI. This hook exists so the app-wide site-state banner can
 * poll too — mounted once at the App level it makes the stale-data /
 * unreachable / emergency / critical warnings appear on every page, not
 * just the ones that happen to fetch alarms.
 *
 * Pass `enabled = false` (e.g. when no site is selected) to skip polling.
 *
 * Only the most recently issued poll may publish (see [createPollSequence]):
 * polls overlap, and a slow failure landing after a newer success would raise
 * a false "unreachable" emergency banner.
 */
export function useActiveAlarmStatus(enabled = true): ActiveAlarmStatus {
  const [status, setStatus] = useState<ActiveAlarmsResponse | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setStatus(null);
      setUnreachable(false);
      return;
    }
    let mounted = true;
    const sequence = createPollSequence();
    const load = async () => {
      const isLatest = sequence.begin();
      const current = () => mounted && isLatest();
      try {
        const response = await fetchActiveAlarms();
        if (current()) {
          setStatus(response);
          setUnreachable(false);
        }
      } catch (err) {
        errorLog('Active alarm status poll failed:', err);
        if (current()) setUnreachable(true);
      }
    };
    void load();
    const interval = setInterval(() => { void load(); }, POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [enabled]);

  return { status, unreachable };
}
