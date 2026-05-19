/**
 * Alarm acknowledgement state — Three Mile Island / Chernobyl style.
 *
 * Operators in cascade-alarm scenarios couldn't prioritize because they
 * couldn't silence the flashing without losing the signal that the
 * alarm was still there. The Acknowledge action stops the flash for a
 * configurable timeout (per severity) so the operator can attend to
 * other problems, while leaving the red outline in place so the alarm
 * stays findable.
 *
 * Storage is intentionally `sessionStorage`: ack state should not
 * survive a reload — a fresh tab gets a fresh picture of the active
 * alarms. Keys are scoped by `alarm_num` so two alarms with overlapping
 * lifetimes don't share an ack.
 */

import { useCallback, useEffect, useState } from 'react';
import type { AlarmSeverityDto } from '@newtown-energy/types';

const STORAGE_KEY = 'neems.alarmAcknowledgements';

/**
 * Per-severity acknowledgement timeout in milliseconds. Higher severities
 * get *shorter* timeouts — the operator should re-see the flash sooner
 * for critical conditions. Info-level alarms get the longest pause so
 * the operator isn't pestered.
 */
export const ACK_TIMEOUT_MS_BY_SEVERITY: Record<AlarmSeverityDto, number> = {
  Emergency: 30_000,
  Critical: 60_000,
  Warning: 5 * 60_000,
  Info: 15 * 60_000
};

interface AckRecord {
  /** Wall-clock ms epoch when the ack expires and the flash resumes. */
  expiresAt: number;
}

type AckMap = Record<string, AckRecord>;

function readStored(): AckMap {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object') return {};
    const out: AckMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v && typeof v === 'object' && typeof (v as AckRecord).expiresAt === 'number') {
        out[k] = { expiresAt: (v as AckRecord).expiresAt };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeStored(value: AckMap): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // sessionStorage disabled — fall back to per-render in-memory state.
  }
}

function pruneExpired(map: AckMap, now: number): AckMap {
  let changed = false;
  const next: AckMap = {};
  for (const [k, v] of Object.entries(map)) {
    if (v.expiresAt > now) {
      next[k] = v;
    } else {
      changed = true;
    }
  }
  return changed ? next : map;
}

function ackKey(alarmNum: number): string {
  return String(alarmNum);
}

/**
 * Read whether [alarmNum] is currently within its ack window. Cheap
 * sessionStorage read; safe to call from render.
 */
export function isAlarmAcknowledged(alarmNum: number, now: number = Date.now()): boolean {
  const record = readStored()[ackKey(alarmNum)];
  return record != null && record.expiresAt > now;
}

/** Persist an ack for [alarmNum] using the per-severity timeout. */
export function acknowledgeAlarm(alarmNum: number, severity: AlarmSeverityDto): void {
  const timeout = ACK_TIMEOUT_MS_BY_SEVERITY[severity];
  const map = readStored();
  map[ackKey(alarmNum)] = { expiresAt: Date.now() + timeout };
  writeStored(map);
  // Notify in-tab listeners — `storage` only fires cross-tab.
  window.dispatchEvent(new CustomEvent('neems:alarmAck'));
}

/** Drop the ack for [alarmNum] immediately. */
export function clearAlarmAcknowledgement(alarmNum: number): void {
  const map = readStored();
  const key = ackKey(alarmNum);
  if (key in map) {
    delete map[key];
    writeStored(map);
    window.dispatchEvent(new CustomEvent('neems:alarmAck'));
  }
}

/**
 * React hook that tracks ack state for a specific [alarmNum] and resets
 * automatically when the timeout elapses. Re-renders when:
 *
 *   - another component in this tab acks or clears (via the custom event)
 *   - the ack window expires naturally (via a deferred timer)
 *   - sessionStorage changes in another tab (via the `storage` event)
 */
export function useAlarmAcknowledged(
  alarmNum: number | null
): {
  acknowledged: boolean;
  acknowledge: (severity: AlarmSeverityDto) => void;
  clear: () => void;
  /** Approximate seconds remaining in the current ack window, or 0 when not acked. */
  remainingSeconds: number;
} {
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (alarmNum == null) return;
    const record = readStored()[ackKey(alarmNum)];
    if (!record) return;
    const ms = record.expiresAt - Date.now();
    if (ms <= 0) return;
    // setTimeout caps at ~24.8 days; alarms ack windows are way under that.
    const id = window.setTimeout(bump, ms + 50);
    return () => window.clearTimeout(id);
  }, [alarmNum, tick, bump]);

  useEffect(() => {
    const handler = (): void => bump();
    window.addEventListener('storage', handler);
    window.addEventListener('neems:alarmAck', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('neems:alarmAck', handler);
    };
  }, [bump]);

  if (alarmNum == null) {
    return {
      acknowledged: false,
      acknowledge: () => {
        /* no-op when no alarm targeted */
      },
      clear: () => {
        /* no-op */
      },
      remainingSeconds: 0
    };
  }

  const now = Date.now();
  const map = pruneExpired(readStored(), now);
  const record = map[ackKey(alarmNum)];
  const acknowledged = record != null && record.expiresAt > now;

  return {
    acknowledged,
    acknowledge: (severity: AlarmSeverityDto) => acknowledgeAlarm(alarmNum, severity),
    clear: () => clearAlarmAcknowledgement(alarmNum),
    remainingSeconds: acknowledged ? Math.ceil((record.expiresAt - now) / 1000) : 0
  };
}

/**
 * Aggregate ack check for a *set* of alarms. Returns true only when
 * every supplied alarm is currently acknowledged. The SLD pulse needs
 * this — a component pulses if *any* of its active alarms is unacked,
 * so the component appears acknowledged only when all of them are.
 */
export function useAllAlarmsAcknowledged(alarmNums: number[]): boolean {
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    const handler = (): void => bump();
    window.addEventListener('storage', handler);
    window.addEventListener('neems:alarmAck', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('neems:alarmAck', handler);
    };
  }, [bump]);

  // Touch tick so React knows we're reactive to it; the read below is
  // a fresh sessionStorage hit on every render anyway.
  void tick;

  if (alarmNums.length === 0) return false;
  const now = Date.now();
  const map = readStored();
  return alarmNums.every(num => {
    const rec = map[ackKey(num)];
    return rec != null && rec.expiresAt > now;
  });
}
