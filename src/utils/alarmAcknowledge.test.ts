/**
 * Unit tests for the alarm acknowledgement helpers.
 *
 * Run with `bun test src/utils/alarmAcknowledge.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

// Bun's test env has no DOM — install a sessionStorage shim and a
// no-op window event API before importing the module.
if (typeof globalThis.sessionStorage === 'undefined') {
  const memory = new Map<string, string>();
  const shim: Storage = {
    get length() { return memory.size; },
    clear: () => memory.clear(),
    getItem: (k) => memory.get(k) ?? null,
    key: (i) => Array.from(memory.keys())[i] ?? null,
    removeItem: (k) => { memory.delete(k); },
    setItem: (k, v) => { memory.set(k, String(v)); },
  };
  // @ts-expect-error -- polyfill at runtime
  globalThis.sessionStorage = shim;
}

if (typeof globalThis.window === 'undefined') {
  type Listener = (e: Event) => void;
  const listeners = new Map<string, Set<Listener>>();
  const fakeWindow = {
    addEventListener: (type: string, listener: Listener) => {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener: (type: string, listener: Listener) => {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent: (event: Event) => {
      listeners.get(event.type)?.forEach(l => l(event));
      return true;
    },
    setTimeout: (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(id),
  };
  // @ts-expect-error -- polyfill at runtime
  globalThis.window = fakeWindow;
}

if (typeof globalThis.CustomEvent === 'undefined') {
  // Older Bun versions miss CustomEvent in the global; provide a stub.
  // @ts-expect-error -- polyfill at runtime
  globalThis.CustomEvent = class extends Event {
    constructor(type: string) { super(type); }
  };
}

import {
  ACK_TIMEOUT_MS_BY_SEVERITY,
  acknowledgeAlarm,
  clearAlarmAcknowledgement,
  isAlarmAcknowledged,
} from './alarmAcknowledge';

beforeEach(() => globalThis.sessionStorage.clear());
afterEach(() => globalThis.sessionStorage.clear());

describe('alarmAcknowledge', () => {
  test('isAlarmAcknowledged returns false when not yet acked', () => {
    expect(isAlarmAcknowledged(42)).toBe(false);
  });

  test('acknowledgeAlarm sets the ack and isAlarmAcknowledged returns true', () => {
    acknowledgeAlarm(42, 'Critical');
    expect(isAlarmAcknowledged(42)).toBe(true);
  });

  test('clearAlarmAcknowledgement immediately removes the ack', () => {
    acknowledgeAlarm(42, 'Critical');
    clearAlarmAcknowledgement(42);
    expect(isAlarmAcknowledged(42)).toBe(false);
  });

  test('ack expires when the timeout elapses', () => {
    acknowledgeAlarm(42, 'Critical');
    const expiry = Date.now() + ACK_TIMEOUT_MS_BY_SEVERITY.Critical + 1;
    expect(isAlarmAcknowledged(42, expiry)).toBe(false);
  });

  test('Emergency timeout is shorter than Info timeout (priority inverts)', () => {
    expect(ACK_TIMEOUT_MS_BY_SEVERITY.Emergency).toBeLessThan(
      ACK_TIMEOUT_MS_BY_SEVERITY.Info,
    );
  });

  test('two distinct alarm numbers are independent', () => {
    acknowledgeAlarm(1, 'Warning');
    expect(isAlarmAcknowledged(1)).toBe(true);
    expect(isAlarmAcknowledged(2)).toBe(false);
  });
});
