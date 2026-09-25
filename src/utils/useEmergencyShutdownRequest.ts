import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  EmergencyShutdownRequestDto,
  EmergencyShutdownStatusResponse,
} from '@newtown-energy/types';

import { fetchEmergencyShutdownStatus, requestEmergencyShutdown } from './emergencyShutdownApi';
import { errorLog } from './debug';
import { useSiteContext } from './SiteContext';

/** Idle cadence. */
const POLL_INTERVAL_MS = 10_000;

/**
 * Cadence while a request's signal is on its way. An operator waiting to hear
 * that it reached the site should not wait out the idle interval.
 */
const ACTIVE_POLL_INTERVAL_MS = 1_000;

/**
 * How long a delivered request stays announced on the page. Long enough to be
 * seen by someone who looked away after pressing; bounded so a request from
 * yesterday does not sit on the page as if it were news.
 */
const SENT_NOTICE_MS = 5 * 60_000;

export interface EmergencyShutdownRequestState {
  /**
   * Whether the RTAC reports the site's E-stop tripped (alarm 104). Not the
   * request's outcome: a delivered request need never raise it.
   */
  observedActive: boolean;
  /** The latest request and its lifecycle status, or null if none was made. */
  request: EmergencyShutdownRequestDto | null;
  /**
   * True while a request is recorded but its signal has not reached the RTAC
   * yet. This is the only genuinely transient state.
   */
  pending: boolean;
  /**
   * True once the signal reached the RTAC. Says nothing about whether the site
   * acted on it, which this system cannot observe.
   */
  sent: boolean;
  /** The signal reached the RTAC within the last few minutes; see [isRecentlySent]. */
  recentlySent: boolean;
  /**
   * Message from a request whose signal never reached the RTAC at all — the
   * site was never asked.
   */
  failure: string | null;
  /** True while the POST is in flight. */
  submitting: boolean;
  /** Error from the POST itself (as opposed to a request that failed later). */
  error: string | null;
  /** Ask the site to shut down. No-op when no site is selected. */
  trigger: () => Promise<void>;
  /** Clear a surfaced submit error without touching request state. */
  dismissError: () => void;
}

/** The signal has not reached the RTAC yet. */
export function isAwaitingSignal(request: EmergencyShutdownRequestDto | null): boolean {
  return request?.status === 'pending';
}

/** The signal reached the RTAC, which is all this system undertakes to do. */
export function hasBeenSent(request: EmergencyShutdownRequestDto | null): boolean {
  return request?.status === 'dispatched';
}

/**
 * The signal reached the RTAC recently enough to still be news to the operator.
 *
 * Only delivery is reported. What the site then did is not visible from here —
 * in particular it is not read off the E-stop (alarm 104), which a real site
 * need not raise for a shutdown request.
 */
export function isRecentlySent(request: EmergencyShutdownRequestDto | null, now: number): boolean {
  if (!hasBeenSent(request)) return false;
  const sentAt = parseUtc(request?.dispatched_at);
  return sentAt != null && now - sentAt < SENT_NOTICE_MS;
}

/**
 * Why the signal never got out, if it didn't.
 *
 * Only ever set for a request that could not be delivered — a request is never
 * failed because the RTAC declined to trip.
 */
export function deliveryFailure(request: EmergencyShutdownRequestDto | null): string | null {
  if (request?.status !== 'failed') return null;
  return request.failure_reason ?? 'the emergency shutdown signal never reached the site';
}

/** Backend timestamps are naive UTC; see SocMiniChart for the same handling. */
function parseUtc(timestamp: string | null | undefined): number | null {
  if (!timestamp) return null;
  const ms = new Date(`${timestamp}Z`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Whether to poll at the fast cadence: while a signal is still going out. */
export function shouldPollQuickly(status: EmergencyShutdownStatusResponse | null): boolean {
  return isAwaitingSignal(status?.request ?? null);
}

/**
 * Track a site's emergency shutdown requests alongside what the RTAC reports
 * about its E-stop.
 *
 * The two are deliberately separate and neither stands in for the other.
 * Triggering records a request and watches it reach the RTAC, which is as far
 * as this system can follow it. `observedActive` is the site's E-stop (alarm
 * 104), reported alongside because operators want both in view, and is not
 * evidence about the request either way.
 */
export function useEmergencyShutdownRequest(enabled = true): EmergencyShutdownRequestState {
  const { selectedSiteId } = useSiteContext();
  const [status, setStatus] = useState<EmergencyShutdownStatusResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read inside the poll callback without making it a dependency, so changing
  // cadence does not tear down and restart the interval mid-request.
  const statusRef = useRef<EmergencyShutdownStatusResponse | null>(null);
  statusRef.current = status;

  const active = enabled && selectedSiteId != null;

  const load = useCallback(async () => {
    if (selectedSiteId == null) return;
    try {
      const next = await fetchEmergencyShutdownStatus(selectedSiteId);
      setStatus(next);
    } catch (err) {
      // Keep the last-known status rather than blanking the indicator: a
      // failed poll is not evidence the site is running.
      errorLog('Emergency shutdown status poll failed:', err);
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
      const delay = shouldPollQuickly(statusRef.current)
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
      setStatus(await requestEmergencyShutdown(selectedSiteId));
    } catch (err) {
      errorLog('Emergency shutdown request failed:', err);
      setError(
        err instanceof Error
          ? `Emergency shutdown request failed: ${err.message}`
          : 'Emergency shutdown request failed',
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
    recentlySent: isRecentlySent(request, Date.now()),
    failure: deliveryFailure(request),
    submitting,
    error,
    trigger,
    dismissError,
  };
}
