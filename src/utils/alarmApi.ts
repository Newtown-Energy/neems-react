import type { ActiveAlarmsResponse, AlarmDefinitionsResponse } from '@newtown-energy/types';
import { apiRequest } from './api';

export async function fetchActiveAlarms(): Promise<ActiveAlarmsResponse> {
  return await apiRequest<ActiveAlarmsResponse>('/api/1/Alarms/Active');
}

export async function fetchAlarmDefinitions(): Promise<AlarmDefinitionsResponse> {
  return await apiRequest<AlarmDefinitionsResponse>('/api/1/Alarms/Definitions');
}
