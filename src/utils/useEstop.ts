import { useCallback, useEffect, useRef, useState } from 'react';
import type { EstopRequestDto, EstopStatusResponse } from '@newtown-energy/types';

import { fetchEstopStatus, requestEstop } from './estopApi';
import { errorLog } from './debug';
import { useSiteContext } from './SiteContext';

/** Idle cadence. Fast enough that a trip from elsewhere shows up promptly. */
const POLL_INTERVAL_MS = 10_000;

/**
 * Cadence while a request is in flight, or just after its signal went out. An
 * operator watching for the plant to stop should not wait out the idle
 * interval.
 */
const ACTIVE_POLL_INTERVAL_MS = 1_000;

/**
 * How long after the signal reaches the RTAC we keep watching closely for a
 * trip.
 *
 * The RTAC is polled at 10 Hz and readings land at 1 Hz, so a trip shows up
 * well inside this. It is bounded because "sent but no trip" is a state that
 * can last indefinitely — the RTAC is entitled to ignore us — and that must
 * not leave the browser polling every second forever.
 */
const WATCH_FOR_TRIP_MS = 60_000;

export interface EstopState {
  /**
   * Whether the RTAC reports the site tripped (alarm 104). The only field that
   * should drive "is the site stopped" in the UI.
   */
  observedActive: boolean;
  /** The latest request and its lifecycle status, or null if none was made. */
  request: EstopRequestDto | null;
  /**
   * True while a request is recorded but its signal has not reached the RTAC
   * yet. This is the only genuinely transient state.
   */
  pending: boolean;
  /**
   * True once the signal reached the RTAC. Says nothing about whether the plant
   * stopped — that is `observedActive`, and the two are independent.
   */
  sent: boolean;
  /**
   * The signal went out and the site still reports no trip. Not a failure of
   * this system, but the operator needs to know the plant has not stopped.
   */
  sentWithoutTrip: boolean;
  /**
   * Message from a request whose signal never reached the RTAC at all — the
   * site was never asked. Distinct from `sentWithoutTrip`, and more serious.
   */
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

/** The signal has not reached the RTAC yet. */
export function isAwaitingSignal(request: EstopRequestDto | null): boolean {
  return request?.status === 'pending';
}

/** The signal reached the RTAC, which is all this system undertakes to do. */
export function hasBeenSent(request: EstopRequestDto | null): boolean {
  return request?.status === 'dispatched';
}

/**
 * Why the signal never got out, if it didn't.
 *
 * Only ever set for a request that could not be delivered — a request is never
 * failed because the RTAC declined to trip.
 */
export function deliveryFailure(request: EstopRequestDto | null): string | null {
  if (request?.status !== 'failed') return null;
  return request.failure_reason ?? 'the E-stop signal never reached the site';
}

/** Backend timestamps are naive UTC; see SocMiniChart for the same handling. */
function parseUtc(timestamp: string | null | undefined): number | null {
  if (!timestamp) return null;
  const ms = new Date(`${timestamp}Z`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Whether to poll at the fast cadence: while a signal is still going out, and
 * for a bounded window afterwards while we watch for the plant to stop.
 */
export function shouldPollQuickly(
  status: EstopStatusResponse | null,
  now: number,
): boolean {
  const request = status?.request ?? null;
  if (isAwaitingSignal(request)) return true;
  if (!hasBeenSent(request) || status?.observed_active) return false;

  const sentAt = parseUtc(request?.dispatched_at);
  return sentAt != null && now - sentAt < WATCH_FOR_TRIP_MS;
}

/**
 * Track a site's E-stop: what the RTAC reports, and what became of an
 * operator's request.
 *
 * The two are deliberately separate and neither stands in for the other.
 * Triggering records a request and watches it reach the RTAC; whether the
 * plant then stops is `observedActive`, read from alarm 104. The UI can only
 * ever claim the site is stopped because the RTAC said so, and can only claim
 * the operator's ask went out because the collector confirmed the write.
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
      const delay = shouldPollQuickly(statusRef.current, Date.now())
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
  const observedActive = status?.observed_active ?? false;
  const sent = hasBeenSent(request);

  return {
    observedActive,
    request,
    pending: isAwaitingSignal(request),
    sent,
    sentWithoutTrip: sent && !observedActive,
    failure: deliveryFailure(request),
    submitting,
    error,
    trigger,
    dismissError,
  };
}
