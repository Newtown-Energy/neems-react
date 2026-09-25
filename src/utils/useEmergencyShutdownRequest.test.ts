/**
 * Unit tests for the emergency shutdown request logic.
 *
 * The point being pinned down here is that "our signal got out" and "the plant
 * stopped" are separate facts. The backend resolves a request once the signal
 * reaches the RTAC and never on the strength of a trip, so the UI must not
 * treat a delivered signal as a stopped site, nor an untripped site as a failed
 * request. The hook itself is exercised by Puppeteer E2E tests; these cover the
 * pure decisions it is built from.
 *
 * Run with `bun test src/utils/useEmergencyShutdownRequest.test.ts`.
 */

import { describe, expect, test } from 'bun:test';
import type {
  EmergencyShutdownRequestDto,
  EmergencyShutdownStatusResponse,
} from '@newtown-energy/types';

import {
  deliveryFailure,
  hasBeenSent,
  isAwaitingSignal,
  isRecentlySent,
  shouldPollQuickly,
} from './useEmergencyShutdownRequest';

/** A naive-UTC timestamp `secondsAgo` in the past, as the backend renders it. */
function naiveUtcAgo(secondsAgo: number): string {
  return new Date(Date.now() - secondsAgo * 1000).toISOString().slice(0, 19);
}

function request(
  overrides: Partial<EmergencyShutdownRequestDto> = {},
): EmergencyShutdownRequestDto {
  return {
    id: 1,
    site_id: 1,
    status: 'pending',
    requested_by: 7,
    requested_at: naiveUtcAgo(1),
    dispatched_at: null,
    resolved_at: null,
    failure_reason: null,
    ...overrides,
  };
}

function status(
  overrides: Partial<EmergencyShutdownStatusResponse> = {},
): EmergencyShutdownStatusResponse {
  return {
    site_id: 1,
    observed_active: false,
    observed_at: null,
    observed_age_seconds: null,
    request: null,
    ...overrides,
  };
}

describe('request lifecycle', () => {
  test('a pending request is still waiting on its signal', () => {
    expect(isAwaitingSignal(request())).toBe(true);
    expect(hasBeenSent(request())).toBe(false);
  });

  test('a dispatched request has been sent and is no longer waiting', () => {
    const sent = request({ status: 'dispatched', dispatched_at: naiveUtcAgo(1) });
    expect(isAwaitingSignal(sent)).toBe(false);
    expect(hasBeenSent(sent)).toBe(true);
  });

  test('no request is neither waiting nor sent', () => {
    expect(isAwaitingSignal(null)).toBe(false);
    expect(hasBeenSent(null)).toBe(false);
  });
});

describe('delivery failure', () => {
  test('is reported only for a request that never reached the site', () => {
    expect(deliveryFailure(request({ status: 'failed', failure_reason: 'no collector' }))).toBe(
      'no collector',
    );
  });

  test('falls back to a message rather than showing nothing', () => {
    expect(deliveryFailure(request({ status: 'failed' }))).toBeTruthy();
  });

  test('a sent signal is never a failure, however the site behaves', () => {
    const sent = request({ status: 'dispatched', dispatched_at: naiveUtcAgo(1) });
    expect(deliveryFailure(sent)).toBeNull();
    expect(deliveryFailure(request())).toBeNull();
    expect(deliveryFailure(null)).toBeNull();
  });
});

describe('poll cadence', () => {
  test('is fast while the signal is still going out', () => {
    expect(shouldPollQuickly(status({ request: request() }))).toBe(true);
  });

  // Delivery is the end of what this system can follow. There is no trip to
  // watch for: a real site need not raise alarm 104 for a shutdown request.
  test('drops back as soon as the signal lands', () => {
    const sent = request({ status: 'dispatched', dispatched_at: naiveUtcAgo(2) });
    expect(shouldPollQuickly(status({ request: sent }))).toBe(false);
  });

  test('is idle with no request, or once one has failed', () => {
    expect(shouldPollQuickly(status())).toBe(false);
    expect(shouldPollQuickly(null)).toBe(false);
    expect(shouldPollQuickly(status({ request: request({ status: 'failed' }) }))).toBe(false);
  });
});

describe('recently sent', () => {
  const now = Date.now();

  test('a signal delivered moments ago is announced', () => {
    const sent = request({ status: 'dispatched', dispatched_at: naiveUtcAgo(5) });
    expect(isRecentlySent(sent, now)).toBe(true);
  });

  test('an old delivery is not news', () => {
    const sent = request({ status: 'dispatched', dispatched_at: naiveUtcAgo(60 * 60) });
    expect(isRecentlySent(sent, now)).toBe(false);
  });

  test('nothing delivered, nothing announced', () => {
    expect(isRecentlySent(null, now)).toBe(false);
    expect(isRecentlySent(request(), now)).toBe(false);
    expect(isRecentlySent(request({ status: 'failed' }), now)).toBe(false);
  });
});
