import type {
  ActiveAlarmsResponse,
  AlarmDefinitionsResponse,
  AlarmHistoryResponse,
} from '@newtown-energy/types';
import { apiRequest } from './api';

export async function fetchActiveAlarms(): Promise<ActiveAlarmsResponse> {
  return await apiRequest<ActiveAlarmsResponse>('/api/1/Alarms/Active');
}

export async function fetchAlarmDefinitions(): Promise<AlarmDefinitionsResponse> {
  return await apiRequest<AlarmDefinitionsResponse>('/api/1/Alarms/Definitions');
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
  return await apiRequest<AlarmHistoryResponse>(`/api/1/Alarms/History?${params.toString()}`);
}
