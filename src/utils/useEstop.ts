import { useCallback, useEffect, useRef, useState } from 'react';
import type { EstopRequestDto, EstopStatusResponse } from '@newtown-energy/types';

import { fetchEstopStatus, requestEstop } from './estopApi';
import { errorLog } from './debug';
import { useSiteContext } from './SiteContext';

/** Idle cadence. Fast enough that a trip from elsewhere shows up promptly. */
const POLL_INTERVAL_MS = 10_000;

/**
 * Cadence while a request is in flight. An operator watching for their trip to
 * take should not wait out the idle interval.
 */
const ACTIVE_POLL_INTERVAL_MS = 1_000;

export interface EstopState {
  /**
   * Whether the RTAC reports the site tripped. The only field that should
   * drive "is the site stopped" in the UI.
   */
  observedActive: boolean;
  /** The latest request and its lifecycle status, or null if none was made. */
  request: EstopRequestDto | null;
  /** True while a request is recorded but not yet resolved by the RTAC. */
  pending: boolean;
  /** Message from a request that was dispatched but never took effect. */
  failure: string | null;
  /** True while the POST is in flight. */
  submitting: boolean;
  /** Error from the POST itself (as opposed to a request that failed later). */
  error: string | null;
  /** Ask for a trip. No-op when no site is selected. */
  trigger: () => Promise<void>;
  /** Clear a surfaced submit error without touching request state. */
  dismissError: () => void;
}

function isPending(request: EstopRequestDto | null): boolean {
  return request?.status === 'pending' || request?.status === 'dispatched';
}

/**
 * Track a site's E-stop: what the RTAC reports and what an operator has asked
 * for.
 *
 * The two are deliberately separate. Triggering does not flip anything locally
 * — it records a request and then watches `observed_active`, so the UI can only
 * ever claim the site is stopped because the RTAC said so.
 */
export function useEstop(enabled = true): EstopState {
  const { selectedSiteId } = useSiteContext();
  const [status, setStatus] = useState<EstopStatusResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read inside the poll callback without making it a dependency, so changing
  // cadence does not tear down and restart the interval mid-request.
  const statusRef = useRef<EstopStatusResponse | null>(null);
  statusRef.current = status;

  const active = enabled && selectedSiteId != null;

  const load = useCallback(async () => {
    if (selectedSiteId == null) return;
    try {
      const next = await fetchEstopStatus(selectedSiteId);
      setStatus(next);
    } catch (err) {
      // Keep the last-known status rather than blanking the indicator: a
      // failed poll is not evidence the site is running.
      errorLog('E-stop status poll failed:', err);
    }
  }, [selectedSiteId]);

  useEffect(() => {
    if (!active) {
      setStatus(null);
      return;
    }
    let mounted = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (!mounted) return;
      await load();
      if (!mounted) return;
      const delay = isPending(statusRef.current?.request ?? null)
        ? ACTIVE_POLL_INTERVAL_MS
        : POLL_INTERVAL_MS;
      timer = setTimeout(() => { void tick(); }, delay);
    };

    void tick();
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [active, load]);

  const trigger = useCallback(async () => {
    if (selectedSiteId == null) return;
    setSubmitting(true);
    setError(null);
    try {
      setStatus(await requestEstop(selectedSiteId));
    } catch (err) {
      errorLog('E-stop request failed:', err);
      setError(
        err instanceof Error
          ? `E-stop request failed: ${err.message}`
          : 'E-stop request failed',
      );
    } finally {
      setSubmitting(false);
    }
  }, [selectedSiteId]);

  const dismissError = useCallback(() => setError(null), []);

  const request = status?.request ?? null;

  return {
    observedActive: status?.observed_active ?? false,
    request,
    pending: isPending(request),
    failure: request?.status === 'failed' ? (request.failure_reason ?? 'E-stop did not take effect') : null,
    submitting,
    error,
    trigger,
    dismissError,
  };
}
