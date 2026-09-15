import { useCallback, useEffect, useRef, useState } from 'react';
import type { ControlRequestDto, SiteControlDto } from '@newtown-energy/types';

import type { SwitchPosition } from '../components/SingleLineDiagram/types';

import { fetchSiteControls, requestControlAction } from './controlApi';
import { errorLog } from './debug';
import { useSiteContext } from './SiteContext';

/** Idle cadence, matching the E-stop's: a request made elsewhere shows up promptly. */
const POLL_INTERVAL_MS = 10_000;

/** Cadence while a request is still on its way to the RTAC. */
const ACTIVE_POLL_INTERVAL_MS = 1_000;

/** What the diagram draws next to one element. */
export interface ControlRequestView {
  /**
   * `pending` from the click until the change registers at the site, whether
   * or not the signal has gone out yet; `failed` when it never will.
   */
  status: 'pending' | 'failed';
  /** Why the signal did not get out. Only ever set when `status` is `failed`. */
  reason: string | null;
}

export interface SiteControlsState {
  /** Every interactable element the backend serves, keyed by control id. */
  controls: Record<string, SiteControlDto>;
  /**
   * What to draw against one element, or `null` when there is nothing to say.
   * Judged against the position the diagram is drawing on this render, so a
   * request clears on the same render that shows the equipment arriving.
   */
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
  actionFor: (controlId: string, position: SwitchPosition | undefined) => string | null;
  /**
   * The most recent failure to surface to the operator, with the label of the
   * element it belongs to. `null` once dismissed.
   */
  failure: { controlId: string; label: string; reason: string } | null;
  dismissFailure: () => void;
}

/**
 * The action a click asks for, chosen against what the control actually
 * accepts.
 *
 * The position says what the click *means* — a closed breaker is asking to
 * open — and the backend says what the control accepts, so the implied action
 * is a proposal that has to be checked rather than an answer. A position of
 * `unknown` implies nothing at all.
 *
 * `null` means "do not offer this click at all": better an element that does
 * nothing than one that sends a request the backend is going to refuse.
 */
export function chooseAction(
  control: SiteControlDto | undefined,
  position: SwitchPosition | undefined,
): string | null {
  if (!control || control.actions.length === 0) return null;

  // A position we do not have cannot imply anything. "The opposite of what it
  // shows" is meaningless for a breaker showing `?`, and guessing would send a
  // real command to plant on the strength of a reading we just admitted we do
  // not have. The single-action rule below still applies: tripping a lockout
  // relay means the same thing whatever its current position.
  if (position === 'open' || position === 'closed') {
    const implied = position === 'closed' ? 'open' : 'close';
    if (control.actions.includes(implied)) return implied;
  }

  // A control with exactly one action has no ambiguity to resolve — the
  // lockout relay accepts `trip` and nothing else, and a click on it can only
  // mean that. Anything else with a position we cannot act on stays inert.
  return control.actions.length === 1 ? control.actions[0] : null;
}

/**
 * Where a request leaves its equipment, mirroring neems-data's
 * `resulting_position`: tripping leaves a relay open. `null` for an action this
 * does not know, which then never clears on position alone.
 */
export function targetPosition(action: string): SwitchPosition | null {
  if (action === 'open' || action === 'trip') return 'open';
  if (action === 'close') return 'closed';
  return null;
}

/**
 * Whether the diagram is drawing a sent request's equipment where it asked to
 * go.
 *
 * Only a `sent` request can arrive: equipment already in place while the signal
 * is still on its way got there without it.
 */
export function hasReachedTarget(
  request: ControlRequestDto,
  position: SwitchPosition | undefined,
): boolean {
  return request.status === 'sent' && position === targetPosition(request.action);
}

/**
 * Whether a request is still worth drawing.
 *
 * `failed` stays up, because an operator has to see it, and so does anything
 * that has not yet got out. A `sent` request stays up until its change has
 * registered, and there are two ways to know that. `arrived` — the diagram has
 * drawn the equipment reaching its target at some render since — is what
 * clears it the moment the equipment gets there. The backend's `registered`
 * says the same thing, and is what keeps it cleared after a reload, when
 * nothing on the page saw it arrive.
 *
 * Deliberately not a timer. A request the site never acts on stays up.
 */
export function isRequestVisible(
  request: ControlRequestDto | null | undefined,
  arrived: boolean,
): boolean {
  if (!request) return false;
  if (request.status !== 'sent') return true;
  return !(request.registered || arrived);
}

/**
 * What to draw for one element's latest request, on one render.
 *
 * Pure: `arrived` holds the requests committed renders have already drawn
 * arriving (see [recordArrivals]), and the position drawn on this render counts
 * too, so the badge clears on the very render that shows the equipment get
 * there.
 */
export function requestView(
  request: ControlRequestDto | null,
  position: SwitchPosition | undefined,
  arrived: ReadonlySet<number>,
): ControlRequestView | null {
  if (!request) return null;
  const hasArrived = arrived.has(request.id) || hasReachedTarget(request, position);
  if (!isRequestVisible(request, hasArrived)) return null;
  return request.status === 'failed'
    ? { status: 'failed', reason: request.failure_reason }
    : { status: 'pending', reason: null };
}

/**
 * Remember every latest request whose equipment a committed render drew at its
 * target, so its badge stays cleared if the equipment moves straight back
 * before the backend's `registered` arrives.
 *
 * Forgets any request that is no longer some control's latest: nothing draws it
 * any more, and keeping it would grow the set by one entry per operation for as
 * long as the page stays open. So the set holds at most one id per control, and
 * empties when the site changes and the control list is cleared.
 *
 * For an effect, not for render: a render can be discarded before it commits,
 * and an arrival it drew was never on screen.
 */
export function recordArrivals(
  controls: SiteControlDto[],
  positionOf: (controlId: string) => SwitchPosition | undefined,
  arrived: Set<number>,
): void {
  const latest = new Set<number>();
  for (const control of controls) {
    const request = control.latest_request;
    if (!request) continue;
    latest.add(request.id);
    if (hasReachedTarget(request, positionOf(control.id))) arrived.add(request.id);
  }
  for (const id of arrived) {
    if (!latest.has(id)) arrived.delete(id);
  }
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
 *
 * `positionOf` is the position the diagram is drawing for a control. It decides
 * only when a request's badge goes away, never the other way round.
 */
export function useSiteControls(
  positionOf: (controlId: string) => SwitchPosition | undefined,
  enabled = true,
): SiteControlsState {
  const { selectedSiteId } = useSiteContext();
  const [controls, setControls] = useState<SiteControlDto[]>([]);
  const [dismissed, setDismissed] = useState<number | null>(null);

  // Read inside the poll callback without making it a dependency, so changing
  // cadence does not tear down and restart the interval mid-request.
  const controlsRef = useRef<SiteControlDto[]>([]);
  controlsRef.current = controls;

  // Requests a committed render has drawn arriving. Recorded after commit, never
  // during render, and kept so equipment that arrives and moves straight back
  // does not bring its badge back before the next poll returns `registered`.
  const arrivedRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    recordArrivals(controls, positionOf, arrivedRef.current);
  });

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
        registered: false,
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

  const actionFor = (
    controlId: string,
    position: SwitchPosition | undefined,
  ): string | null => chooseAction(byId[controlId], position);

  const viewFor = (controlId: string): ControlRequestView | null =>
    requestView(byId[controlId]?.latest_request ?? null, positionOf(controlId), arrivedRef.current);

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
