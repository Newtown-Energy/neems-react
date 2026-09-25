import { useCallback, useEffect, useRef, useState } from 'react';
import type { ControlRequestDto, SiteControlDto } from '@newtown-energy/types';

import type { SwitchPosition } from '../components/SingleLineDiagram/types';

import { fetchSiteControls, requestControlAction } from './controlApi';
import { errorLog } from './debug';
import { useSiteContext } from './SiteContext';

/** Idle cadence, matching the emergency shutdown request's: a request made elsewhere shows up promptly. */
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
 * that has not yet got out. A `sent` request stays up until the diagram draws
 * the equipment at its target — `arrived`, recorded from committed renders —
 * because that is the moment the operator can see the thing they asked for.
 *
 * The backend's `registered` is read off the same readback points, but it sees
 * them the instant they flip while the diagram sees them on the alarm feed's
 * own schedule, so it runs ahead of the picture. Clearing on it alone ends the
 * badge into a diagram still drawing the old position, which is the gap this
 * whole path exists to close. So it only clears a request once the position
 * feed has been refreshed since the registration was seen — `settled`, from
 * [settleRegistrations]. Normally `arrived` gets there first, on the render
 * that draws the refreshed position; `settled` is what still clears equipment
 * that arrived and moved straight back, one refresh later instead of never.
 *
 * Deliberately not a timer. A request the site never acts on stays up.
 */
export function isRequestVisible(
  request: ControlRequestDto | null | undefined,
  arrived: boolean,
  settled: boolean,
): boolean {
  if (!request) return false;
  if (request.status !== 'sent') return true;
  return !(arrived || (request.registered && settled));
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
  settled: ReadonlySet<number>,
): ControlRequestView | null {
  if (!request) return null;
  const hasArrived = arrived.has(request.id) || hasReachedTarget(request, position);
  if (!isRequestVisible(request, hasArrived, settled.has(request.id))) return null;
  return request.status === 'failed'
    ? { status: 'failed', reason: request.failure_reason }
    : { status: 'pending', reason: null };
}

/**
 * Drop every id that is no longer some control's latest request.
 *
 * Nothing draws those any more, and a page left open through a shift would
 * otherwise grow these sets by one entry per operation. So a set holds at most
 * one id per control, and empties when the site changes and the control list is
 * cleared.
 */
export function pruneToLatest(controls: SiteControlDto[], ids: Set<number>): void {
  const latest = new Set<number>();
  for (const control of controls) {
    if (control.latest_request) latest.add(control.latest_request.id);
  }
  for (const id of ids) {
    if (!latest.has(id)) ids.delete(id);
  }
}

/**
 * Remember every latest request whose equipment a committed render drew at its
 * target, so its badge stays cleared if the equipment moves straight back
 * before the backend's `registered` arrives.
 *
 * Forgets anything no longer current, via [pruneToLatest].
 *
 * For an effect, not for render: a render can be discarded before it commits,
 * and an arrival it drew was never on screen.
 */
export function recordArrivals(
  controls: SiteControlDto[],
  positionOf: (controlId: string) => SwitchPosition | undefined,
  arrived: Set<number>,
): void {
  for (const control of controls) {
    const request = control.latest_request;
    if (!request) continue;
    if (hasReachedTarget(request, positionOf(control.id))) arrived.add(request.id);
  }
  pruneToLatest(controls, arrived);
}

/**
 * The registered requests whose position feed still has to catch up.
 *
 * The backend reads the readback points directly, so it reports `registered`
 * before the alarm feed the diagram draws from has been polled again. These are
 * the requests to refresh the position feed for, and to keep drawing until it
 * comes back — see [isRequestVisible].
 *
 * A request already in `settled` is done: it does not matter whether its
 * equipment is still at the target, only that the diagram has had the chance to
 * draw it getting there.
 */
export function unsettledRegistrations(
  controls: SiteControlDto[],
  settled: ReadonlySet<number>,
): number[] {
  const ids: number[] = [];
  for (const control of controls) {
    const request = control.latest_request;
    if (!request || request.status !== 'sent' || !request.registered) continue;
    if (!settled.has(request.id)) ids.push(request.id);
  }
  return ids;
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
 *
 * `refreshPositions` re-reads the feed `positionOf` draws from. The hook calls
 * it when the backend reports a request registered, so the diagram catches up
 * on the next render instead of on that feed's own idle schedule — without it
 * a badge clears seconds before the equipment it describes appears to move.
 * It must resolve to whether it *published*: a poll that failed, or that was
 * discarded in favour of a newer one, left the diagram drawing what it already
 * had, and settling on that would clear a badge against the old position —
 * which is the whole thing this is here to prevent.
 */
export function useSiteControls(
  positionOf: (controlId: string) => SwitchPosition | undefined,
  enabled = true,
  refreshPositions?: () => Promise<boolean>,
): SiteControlsState {
  const { selectedSiteId } = useSiteContext();
  const [controls, setControls] = useState<SiteControlDto[]>([]);
  const [dismissed, setDismissed] = useState<number | null>(null);
  // Bumped when a registration settles. `settledRef` is a ref so `viewFor` can
  // read it during render without it being a dependency anywhere; this is what
  // re-renders on a change to it, and what re-runs the settling effect for
  // anything that registered while a refresh was already in flight.
  const [settledTick, setSettledTick] = useState(0);

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

  // Requests whose registration the position feed has been given a chance to
  // catch up with. Ids only, so a request that settles stays settled even as
  // its equipment moves on.
  const settledRef = useRef<Set<number>>(new Set());
  // Read without depending on it, so passing an unmemoized callback from the
  // diagram does not restart the poll on every render.
  const refreshRef = useRef(refreshPositions);
  refreshRef.current = refreshPositions;
  // One refresh at a time. The effect below runs on every change to `controls`,
  // and a registration can be observed by the poll and by the request that
  // caused it within a render of each other.
  const refreshingRef = useRef(false);
  // The hook's own lifetime. Separate from any effect instance's, so work that
  // outlives a dependency change is still recorded, and only an unmounted hook
  // drops it.
  const liveRef = useRef(true);
  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
    };
  }, []);

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
      settledRef.current.clear();
      arrivedRef.current.clear();
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

  // Let the position feed catch up with anything the backend has newly reported
  // registered, then mark those requests settled.
  //
  // Keyed on `controls` rather than run inside the poll, because a request can
  // come back registered from its own POST — the readback having moved before
  // the response was written — and the next poll may be a full idle interval
  // away. Waiting for it would trade a badge that clears too early for one that
  // clears too late.
  //
  // Both steps matter: the refresh is what makes the diagram draw the new
  // position, and marking the requests settled is what finally releases a badge
  // whose equipment arrived and moved straight back, which no position shows.
  useEffect(() => {
    pruneToLatest(controls, settledRef.current);
    const unsettled = unsettledRegistrations(controls, settledRef.current);
    if (unsettled.length === 0 || refreshingRef.current) return;
    refreshingRef.current = true;
    void (async () => {
      let published = false;
      try {
        published = (await refreshRef.current?.()) ?? false;
      } catch (err) {
        // Nothing to settle against. Leave these and try again rather than
        // clearing a badge on the strength of a refresh that did not land.
        errorLog('Position refresh after control registration failed:', err);
      } finally {
        refreshingRef.current = false;
      }
      // Deliberately not gated on this effect instance still being current: a
      // controls poll landing mid-refresh makes it stale, and dropping the
      // result there would strand a bounce-back badge until some later change
      // happened to re-run this. `liveRef` is the hook's own lifetime, which is
      // the only reason to not record what we just learned.
      if (!liveRef.current || !published) return;
      for (const id of unsettled) settledRef.current.add(id);
      // Only on a real change: bumping unconditionally would re-run this effect
      // on every failed refresh, which is a refresh loop rather than a retry.
      setSettledTick((n) => n + 1);
    })();
  }, [controls, settledTick]);

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
    requestView(
      byId[controlId]?.latest_request ?? null,
      positionOf(controlId),
      arrivedRef.current,
      settledRef.current,
    );

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
