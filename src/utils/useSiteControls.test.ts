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

import { chooseAction, hasRequestInFlight, isRequestVisible } from './useSiteControls';

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
    expect(isRequestVisible(null, Date.now())).toBe(false);
  });

  test('a request still on its way stays up', () => {
    expect(isRequestVisible(request({ status: 'pending' }), Date.now())).toBe(true);
  });

  // The whole reason this path exists: a click that went nowhere has to be
  // visible until someone looks at it, not fade like a success.
  test('a failed request stays up indefinitely', () => {
    const old = request({
      status: 'failed',
      requested_at: naiveUtcAgo(3600),
      resolved_at: naiveUtcAgo(3600),
      failure_reason: 'no RTAC point',
    });
    expect(isRequestVisible(old, Date.now())).toBe(true);
  });

  test('a sent request shows briefly and then clears', () => {
    const justSent = request({ status: 'sent', sent_at: naiveUtcAgo(2) });
    expect(isRequestVisible(justSent, Date.now())).toBe(true);

    const longSent = request({ status: 'sent', sent_at: naiveUtcAgo(600) });
    expect(isRequestVisible(longSent, Date.now())).toBe(false);
  });

  // "Sent" with no timestamp is not evidence of anything, and a badge that
  // never cleared would sit next to a breaker forever implying it moved.
  test('a sent request with no timestamp is not drawn', () => {
    expect(isRequestVisible(request({ status: 'sent', sent_at: null }), Date.now())).toBe(false);
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
});
