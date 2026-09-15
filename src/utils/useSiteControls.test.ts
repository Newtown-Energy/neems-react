/**
 * Unit tests for the site input request logic.
 *
 * The point being pinned down here is that a click is a *request*, and that the
 * diagram must report what became of it without ever implying where the
 * equipment ended up. The hook itself is exercised by Puppeteer E2E tests;
 * these cover the pure decisions it is built from.
 *
 * Run with `bun test src/utils/useSiteControls.test.ts`.
 */

import { describe, expect, test } from 'bun:test';
import type { ControlRequestDto, SiteControlDto } from '@newtown-energy/types';

import {
  chooseAction,
  hasReachedTarget,
  hasRequestInFlight,
  isRequestVisible,
  recordArrivals,
  requestView,
  targetPosition,
} from './useSiteControls';

/** A naive-UTC timestamp `secondsAgo` in the past, as the backend renders it. */
function naiveUtcAgo(secondsAgo: number): string {
  return new Date(Date.now() - secondsAgo * 1000).toISOString().slice(0, 19);
}

function request(overrides: Partial<ControlRequestDto> = {}): ControlRequestDto {
  return {
    id: 1,
    site_id: 1,
    control_id: 'feeder-1a',
    action: 'open',
    status: 'pending',
    requested_by: 1,
    requested_at: naiveUtcAgo(1),
    sent_at: null,
    resolved_at: null,
    failure_reason: null,
    registered: false,
    ...overrides,
  };
}

function control(overrides: Partial<SiteControlDto> = {}): SiteControlDto {
  return {
    id: 'feeder-1a',
    label: '52-MP-1A',
    actions: ['open', 'close'],
    readback_alarm_num: 607,
    writable: false,
    latest_request: null,
    ...overrides,
  };
}

describe('isRequestVisible', () => {
  test('an element nobody has clicked draws nothing', () => {
    expect(isRequestVisible(null, false)).toBe(false);
  });

  test('a request still on its way stays up', () => {
    expect(isRequestVisible(request({ status: 'pending' }), false)).toBe(true);
  });

  test('a failed request stays up indefinitely', () => {
    const old = request({ status: 'failed', requested_at: naiveUtcAgo(3600) });
    expect(isRequestVisible(old, false)).toBe(true);
  });

  test('a sent request stays up until it registers, however long that takes', () => {
    const longSent = request({ status: 'sent', sent_at: naiveUtcAgo(600) });
    expect(isRequestVisible(longSent, false)).toBe(true);
  });

  test('a sent request clears once the diagram has seen it arrive', () => {
    expect(isRequestVisible(request({ status: 'sent' }), true)).toBe(false);
  });

  // The reload case: nothing on this page saw the breaker arrive, and it has
  // since moved back, so its position alone says the request never landed.
  test('a sent request clears once the backend reports it registered', () => {
    expect(isRequestVisible(request({ status: 'sent', registered: true }), false)).toBe(false);
  });
});

describe('hasReachedTarget', () => {
  test('a sent request arrives when the drawn position reaches its target', () => {
    const open = request({ status: 'sent', action: 'open' });
    expect(hasReachedTarget(open, 'open')).toBe(true);
    expect(hasReachedTarget(open, 'closed')).toBe(false);
    expect(hasReachedTarget(open, 'unknown')).toBe(false);
    expect(hasReachedTarget(open, undefined)).toBe(false);
  });

  test('equipment already in place while the signal is on its way has not answered it', () => {
    expect(hasReachedTarget(request({ status: 'pending', action: 'open' }), 'open')).toBe(false);
  });
});

describe('requestView', () => {
  // Each requestView call is one render. recordArrivals is the effect that runs
  // once a render has committed.
  const pending = { status: 'pending', reason: null };

  test('a sent request clears on the render that draws it arriving, and stays cleared after it moves back', () => {
    const arrived = new Set<number>();
    const open = request({ status: 'sent', action: 'open' });

    expect(requestView(open, 'closed', arrived)).toEqual(pending);
    expect(requestView(open, 'open', arrived)).toBe(null);
    recordArrivals([control({ latest_request: open })], () => 'open', arrived);
    expect(requestView(open, 'closed', arrived)).toBe(null);
  });

  // A concurrent render can be thrown away before it commits. An arrival only
  // it drew was never on screen, so it must not keep the badge cleared.
  test('an arrival drawn by a render that never commits is not remembered', () => {
    const arrived = new Set<number>();
    const open = request({ status: 'sent', action: 'open' });

    expect(requestView(open, 'open', arrived)).toBe(null);
    expect(requestView(open, 'closed', arrived)).toEqual(pending);
  });

  test('one request arriving does not clear a newer one on the same element', () => {
    const arrived = new Set<number>();
    const older = request({ id: 1, status: 'sent', action: 'open' });
    recordArrivals([control({ latest_request: older })], () => 'open', arrived);

    const newer = request({ id: 2, status: 'sent', action: 'close' });
    expect(requestView(newer, 'open', arrived)).toEqual(pending);
  });

  test('a request still on its way is not recorded as arrived', () => {
    const arrived = new Set<number>();
    const onItsWay = request({ status: 'pending', action: 'open' });
    recordArrivals([control({ latest_request: onItsWay })], () => 'open', arrived);
    expect(arrived.size).toBe(0);
  });

  test('a request that is no longer any control\'s latest is forgotten', () => {
    const arrived = new Set<number>();
    const older = request({ id: 1, status: 'sent', action: 'open' });
    recordArrivals([control({ latest_request: older })], () => 'open', arrived);
    expect(arrived.has(1)).toBe(true);

    const newer = request({ id: 2, status: 'pending', action: 'close' });
    recordArrivals([control({ latest_request: newer })], () => 'open', arrived);
    expect(arrived.size).toBe(0);
  });

  test('a site with no controls loaded forgets every arrival', () => {
    const arrived = new Set<number>([1, 2, 3]);
    recordArrivals([], () => undefined, arrived);
    expect(arrived.size).toBe(0);
  });

  test('a failed request is drawn with its reason', () => {
    const failed = request({ status: 'failed', failure_reason: 'no RTAC point' });
    expect(requestView(failed, 'closed', new Set())).toEqual({
      status: 'failed',
      reason: 'no RTAC point',
    });
  });
});

describe('targetPosition', () => {
  test('open and trip leave equipment open, close leaves it closed', () => {
    expect(targetPosition('open')).toBe('open');
    expect(targetPosition('trip')).toBe('open');
    expect(targetPosition('close')).toBe('closed');
  });

  test('an action it does not know has no target', () => {
    expect(targetPosition('explode')).toBe(null);
  });
});

describe('hasRequestInFlight', () => {
  test('nothing in flight when no control has been asked for anything', () => {
    expect(hasRequestInFlight([control(), control({ id: 'feeder-1b' })])).toBe(false);
  });

  test('a pending request anywhere on the site raises the poll cadence', () => {
    const controls = [
      control({ latest_request: request({ status: 'failed' }) }),
      control({ id: 'switch-89l-1', latest_request: request({ status: 'pending' }) }),
    ];
    expect(hasRequestInFlight(controls)).toBe(true);
  });

  // Resolved requests are finished work. Polling every second for them would
  // keep the browser busy over a question that already has its answer.
  test('resolved requests do not keep the fast poll running', () => {
    const controls = [
      control({ latest_request: request({ status: 'sent', sent_at: naiveUtcAgo(1) }) }),
      control({ id: 'feeder-1b', latest_request: request({ status: 'failed' }) }),
    ];
    expect(hasRequestInFlight(controls)).toBe(false);
  });
});

describe('chooseAction', () => {
  // A click means "change what you are showing me", so a closed breaker is
  // asking to open.
  test('a two-position control is asked for the opposite of what it shows', () => {
    expect(chooseAction(control(), 'closed')).toBe('open');
    expect(chooseAction(control(), 'open')).toBe('close');
  });

  // The backend states what each control accepts. The lockout relay accepts
  // `trip` and nothing else, and the layout must not need to know that.
  test('a single-action control is asked for that action, whatever it shows', () => {
    const lockout = control({ id: 'lockout-relay', actions: ['trip'] });
    expect(chooseAction(lockout, 'closed')).toBe('trip');
    expect(chooseAction(lockout, 'open')).toBe('trip');
  });

  // The whole point: never send a request the backend has said it will refuse.
  test('an action the control does not accept is not sent', () => {
    const openOnly = control({ actions: ['open'] });
    expect(chooseAction(openOnly, 'closed')).toBe('open');
    // Showing open, so the click implies close — which this control refuses,
    // and it has another action, so there is nothing unambiguous to send.
    expect(chooseAction(control({ actions: ['open', 'trip'] }), 'open')).toBeNull();
  });

  // Before the first poll returns we do not know what the site accepts, so
  // nothing is clickable rather than optimistically clickable.
  test('an unknown control offers no action', () => {
    expect(chooseAction(undefined, 'closed')).toBeNull();
    expect(chooseAction(control({ actions: [] }), 'closed')).toBeNull();
  });

  // A breaker showing `?` cannot imply "the opposite of what it shows", and
  // guessing would send a real command to plant on a reading we just admitted
  // we do not have.
  test('an unknown position offers no positional action', () => {
    expect(chooseAction(control(), 'unknown')).toBeNull();
    expect(chooseAction(control(), undefined)).toBeNull();
  });

  // But a control with one unambiguous action still offers it: tripping a
  // lockout relay means the same thing whatever position it is showing.
  test('a single-action control stays available with an unknown position', () => {
    const lockout = control({ id: 'lockout-relay', actions: ['trip'] });
    expect(chooseAction(lockout, 'unknown')).toBe('trip');
  });
});
