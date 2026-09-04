import { useCallback, useEffect, useRef, useState } from 'react';
import type { ControlRequestDto, SiteControlDto } from '@newtown-energy/types';

import { fetchSiteControls, requestControlAction } from './controlApi';
import { errorLog } from './debug';
import { useSiteContext } from './SiteContext';

/** Idle cadence, matching the E-stop's: a request made elsewhere shows up promptly. */
const POLL_INTERVAL_MS = 10_000;

/** Cadence while a request is still on its way to the RTAC. */
const ACTIVE_POLL_INTERVAL_MS = 1_000;

/**
 * How long a `sent` request stays on the diagram.
 *
 * "The signal got out" is worth showing and then worth clearing: it is terminal,
 * so leaving it up would put a permanent badge on every element anyone has ever
 * clicked. Whether the equipment then moved is a different question with a
 * different indicator — the readback-driven position — and a stale "SENT" next
 * to it would read as an answer to it.
 */
const SENT_VISIBLE_MS = 15_000;

/** What the diagram draws next to one element. */
export interface ControlRequestView {
  status: ControlRequestDto['status'];
  /** The action asked for, for the operator to read back. */
  action: string;
  /** Why the signal did not get out. Only ever set when `status` is `failed`. */
  reason: string | null;
}

export interface SiteControlsState {
  /** Every interactable element the backend serves, keyed by control id. */
  controls: Record<string, SiteControlDto>;
  /** What to draw against one element, or `null` when there is nothing to say. */
  viewFor: (controlId: string) => ControlRequestView | null;
  /**
   * Ask a control to do something. Resolves once the request has been
   * *recorded*, which is not the same as knowing what became of it: the
   * backend may hand back `pending`, and the outcome then arrives on a later
   * poll. Awaiting this tells you the ask was accepted, never that the signal
   * got out. (Today every request resolves immediately, because no control has
   * an RTAC point — that is a property of the current deployment, not a
   * guarantee to write code against.)
   */
  request: (controlId: string, action: string) => Promise<void>;
  /**
   * The action a click on this element should ask for, or `null` if there
   * isn't one — an unknown control, or one whose allowed actions do not cover
   * what the click implies. Callers should leave an element unclickable rather
   * than send a request the backend will refuse.
   */
  actionFor: (controlId: string, position: 'open' | 'closed' | undefined) => string | null;
  /**
   * The most recent failure to surface to the operator, with the label of the
   * element it belongs to. `null` once dismissed.
   */
  failure: { controlId: string; label: string; reason: string } | null;
  dismissFailure: () => void;
}

/** Backend timestamps are naive UTC; see SocMiniChart for the same handling. */
function parseUtc(timestamp: string | null | undefined): number | null {
  if (!timestamp) return null;
  const ms = new Date(`${timestamp}Z`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * The action a click asks for, chosen against what the control actually
 * accepts.
 *
 * The position on the diagram says what the click *means* — a closed breaker
 * is asking to open. But the position is not yet driven by the site
 * (neems-react#113), and the set of actions a control accepts is the
 * backend's to state, so the implied action is a proposal that has to be
 * checked rather than an answer.
 *
 * `null` means "do not offer this click at all": better an element that does
 * nothing than one that sends a request the backend is going to refuse.
 */
export function chooseAction(
  control: SiteControlDto | undefined,
  position: 'open' | 'closed' | undefined,
): string | null {
  if (!control || control.actions.length === 0) return null;

  const implied = position === 'closed' ? 'open' : 'close';
  if (control.actions.includes(implied)) return implied;

  // A control with exactly one action has no ambiguity to resolve — the
  // lockout relay accepts `trip` and nothing else, and a click on it can only
  // mean that. Anything else with a position we cannot act on stays inert.
  return control.actions.length === 1 ? control.actions[0] : null;
}

/**
 * Whether a request is still worth drawing.
 *
 * `pending` and `failed` stay up — one is in progress, the other is an error an
 * operator has to see. `sent` ages out, because it is terminal and says nothing
 * about the equipment.
 */
export function isRequestVisible(
  request: ControlRequestDto | null | undefined,
  now: number,
): boolean {
  if (!request) return false;
  if (request.status !== 'sent') return true;

  const sentAt = parseUtc(request.sent_at);
  return sentAt != null && now - sentAt < SENT_VISIBLE_MS;
}

/** Whether anything is still on its way to the RTAC. */
export function hasRequestInFlight(controls: SiteControlDto[]): boolean {
  return controls.some((c) => c.latest_request?.status === 'pending');
}

/**
 * Track a site's controls and what became of the requests made against them.
 *
 * The hook never reports equipment position, and deliberately cannot: it knows
 * only what was asked for and whether the signal got out. Where a breaker
 * actually sits comes from its readback point, on its own schedule, and the two
 * must be rendered as separate things.
 */
export function useSiteControls(enabled = true): SiteControlsState {
  const { selectedSiteId } = useSiteContext();
  const [controls, setControls] = useState<SiteControlDto[]>([]);
  const [dismissed, setDismissed] = useState<number | null>(null);

  // Read inside the poll callback without making it a dependency, so changing
  // cadence does not tear down and restart the interval mid-request.
  const controlsRef = useRef<SiteControlDto[]>([]);
  controlsRef.current = controls;

  const active = enabled && selectedSiteId != null;

  const load = useCallback(async () => {
    if (selectedSiteId == null) return;
    try {
      setControls(await fetchSiteControls(selectedSiteId));
    } catch (err) {
      // Keep the last-known list rather than blanking the diagram: a failed
      // poll is not evidence that nothing was asked for.
      errorLog('Site controls poll failed:', err);
    }
  }, [selectedSiteId]);

  useEffect(() => {
    if (!active) {
      setControls([]);
      return;
    }
    let mounted = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (!mounted) return;
      await load();
      if (!mounted) return;
      const delay = hasRequestInFlight(controlsRef.current)
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

  const request = useCallback(
    async (controlId: string, action: string) => {
      if (selectedSiteId == null) return;
      // Show the ask immediately. The round trip is short, but a click that
      // leaves the diagram unchanged for even a moment reads as a click that
      // did not register — which is the failure this whole path exists to fix.
      const optimistic: ControlRequestDto = {
        id: -1,
        site_id: selectedSiteId,
        control_id: controlId,
        action,
        status: 'pending',
        requested_by: null,
        requested_at: new Date().toISOString().replace('Z', ''),
        sent_at: null,
        resolved_at: null,
        failure_reason: null,
      };
      setDismissed(null);
      setControls((prev) =>
        prev.map((c) => (c.id === controlId ? { ...c, latest_request: optimistic } : c)),
      );

      try {
        const result = await requestControlAction(selectedSiteId, controlId, action);
        setControls((prev) =>
          prev.map((c) => (c.id === controlId ? { ...c, latest_request: result } : c)),
        );
      } catch (err) {
        errorLog('Control request failed:', err);
        // The POST itself failed, so we do not know whether the ask was
        // recorded. Say so rather than leaving a spinner: the next poll will
        // replace this with whatever the backend actually has.
        setControls((prev) =>
          prev.map((c) =>
            c.id === controlId
              ? {
                  ...c,
                  latest_request: {
                    ...optimistic,
                    status: 'failed',
                    failure_reason:
                      err instanceof Error
                        ? `The request could not be sent: ${err.message}`
                        : 'The request could not be sent.',
                  },
                }
              : c,
          ),
        );
      }
    },
    [selectedSiteId],
  );

  const byId: Record<string, SiteControlDto> = {};
  for (const control of controls) byId[control.id] = control;

  // Evaluated per render rather than on a timer: the poll re-renders at least
  // every 10s, so a `sent` badge clears within one cadence of its window
  // expiring. A dedicated timeout would buy a few seconds of precision on a
  // badge whose whole purpose is to fade.
  const now = Date.now();
  const actionFor = (
    controlId: string,
    position: 'open' | 'closed' | undefined,
  ): string | null => chooseAction(byId[controlId], position);

  const viewFor = (controlId: string): ControlRequestView | null => {
    const request = byId[controlId]?.latest_request ?? null;
    if (!request || !isRequestVisible(request, now)) return null;
    return { status: request.status, action: request.action, reason: request.failure_reason };
  };

  // The newest failure is the one worth interrupting an operator about. Older
  // ones stay on their own elements rather than queueing up as banners.
  const failed = controls
    .filter((c) => c.latest_request?.status === 'failed')
    .sort((a, b) =>
      (a.latest_request?.requested_at ?? '') < (b.latest_request?.requested_at ?? '') ? 1 : -1,
    )[0];
  const failedRequest = failed?.latest_request ?? null;
  const failure =
    failed && failedRequest && failedRequest.id !== dismissed
      ? {
          controlId: failed.id,
          label: failed.label,
          reason: failedRequest.failure_reason ?? 'The signal never reached the site.',
        }
      : null;

  const dismissFailure = useCallback(() => {
    setDismissed(failedRequest?.id ?? null);
  }, [failedRequest]);

  return { controls: byId, viewFor, actionFor, request, failure, dismissFailure };
}
