import type {
  AcknowledgeAlarmResponse,
  ActiveAlarmsResponse,
  AlarmDefinitionsResponse,
  AlarmHistoryResponse,
  DemoAlarmStateResponse,
  ForcedAlarmsResponse,
} from '@newtown-energy/types';
import { apiRequestWithMapping } from './api';

export async function fetchActiveAlarms(): Promise<ActiveAlarmsResponse> {
  return await apiRequestWithMapping<ActiveAlarmsResponse>('/api/1/Alarms/Active');
}

export async function fetchAlarmDefinitions(): Promise<AlarmDefinitionsResponse> {
  return await apiRequestWithMapping<AlarmDefinitionsResponse>('/api/1/Alarms/Definitions');
}

/**
 * Fetch the chronological list of alarm-state transitions in a date range.
 * Optionally filtered to a specific set of alarm_num values.
 */
export async function fetchAlarmHistory(
  from: Date,
  to: Date,
  alarmNums?: number[],
): Promise<AlarmHistoryResponse> {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  if (alarmNums && alarmNums.length > 0) {
    params.set('alarm_nums', alarmNums.join(','));
  }
  return await apiRequestWithMapping<AlarmHistoryResponse>(`/api/1/Alarms/History?${params.toString()}`);
}

/**
 * Read the current set of demo-forced alarm numbers from the backend.
 * Admin / newtown-admin / newtown-staff only.
 */
export async function fetchForcedAlarms(): Promise<ForcedAlarmsResponse> {
  return await apiRequestWithMapping<ForcedAlarmsResponse>('/api/1/Alarms/Forced');
}

/**
 * Read demo alarm data-state: every alarm that has transitioned, plus the
 * numbers currently active. Demo mode only; admin / newtown-admin /
 * newtown-staff only.
 */
export async function fetchDemoAlarmState(): Promise<DemoAlarmStateResponse> {
  return await apiRequestWithMapping<DemoAlarmStateResponse>('/api/1/Demo/AlarmState');
}

/**
 * Activate or deactivate a single alarm for a demo.
 *
 * This writes a real data-state transition, so it behaves like the RTAC feed
 * would: deactivating an alarm does NOT hide it. An alarm that has not been
 * acknowledged since it fired stays visible — no longer firing, still owed an
 * acknowledgement — until an operator acknowledges it, which is the point of
 * the latch.
 */
export async function setDemoAlarmState(
  alarmNum: number,
  active: boolean
): Promise<DemoAlarmStateResponse> {
  return await apiRequestWithMapping<DemoAlarmStateResponse>('/api/1/Demo/AlarmState', {
    method: 'POST',
    body: JSON.stringify({ alarm_num: alarmNum, active }),
  });
}

/**
 * Replace the set of demo-forced alarms on the backend. Pass an empty
 * array to clear all forced alarms.
 */
export async function setForcedAlarms(alarmNums: number[]): Promise<ForcedAlarmsResponse> {
  return await apiRequestWithMapping<ForcedAlarmsResponse>('/api/1/Alarms/Forced', {
    method: 'PUT',
    body: JSON.stringify({ alarm_nums: alarmNums }),
  });
}

/**
 * Acknowledge an active alarm by its `alarm_num`. Acknowledgement is
 * persistent and server-side — it does not necessarily clear the alarm, so
 * callers should re-fetch `/Alarms/Active` afterwards to pick up the updated
 * status. An optional free-form `note` is recorded with the acknowledgement.
 */
export async function acknowledgeAlarm(
  alarmNum: number,
  note?: string,
): Promise<AcknowledgeAlarmResponse> {
  return await apiRequestWithMapping<AcknowledgeAlarmResponse>('/api/1/Alarms/Acknowledge', {
    method: 'POST',
    body: JSON.stringify({ alarm_num: alarmNum, note: note ?? null }),
  });
}
