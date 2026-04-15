import type { ActiveAlarmsResponse, AlarmZoneDto } from '@newtown-energy/types';
import { getSeverityOrder } from '../../utils/alarmHelpers';
import type {
  ActiveAlarmSummary,
  SldComponentState,
  SldDiagramState,
  SldWireState,
  PowerFlowDirection,
} from './types';

// --- Actions ---

export type SldAction =
  | { type: 'UPDATE_ALARMS'; alarms: ActiveAlarmsResponse }
  | { type: 'TOGGLE_BREAKER'; componentId: string }
  | { type: 'SET_POWER_FLOW'; wireId: string; direction: PowerFlowDirection }
  | { type: 'MARK_STALE' };

// --- Helpers ---

function applyAlarms(
  state: SldDiagramState,
  alarms: ActiveAlarmsResponse,
): SldDiagramState {
  // Reset all components to normal
  const updatedComponents: Record<string, SldComponentState> = {};
  for (const [id, comp] of Object.entries(state.components)) {
    updatedComponents[id] = {
      ...comp,
      status: 'normal',
      highestSeverity: null,
      activeAlarmCount: 0,
      activeAlarms: [],
    };
  }

  // Map alarms to components by zone
  for (const alarm of alarms.alarms) {
    // Find component(s) matching this alarm's zone
    for (const [id, comp] of Object.entries(updatedComponents)) {
      if (comp.zone === alarm.zone) {
        const currentOrder = comp.highestSeverity
          ? getSeverityOrder(comp.highestSeverity)
          : Infinity;
        const newOrder = getSeverityOrder(alarm.severity);

        const alarmSummary: ActiveAlarmSummary = {
          name: alarm.name,
          severity: alarm.severity,
        };

        updatedComponents[id] = {
          ...comp,
          activeAlarmCount: comp.activeAlarmCount + 1,
          activeAlarms: [...comp.activeAlarms, alarmSummary],
          highestSeverity:
            newOrder < currentOrder ? alarm.severity : comp.highestSeverity,
          status:
            alarm.severity === 'Emergency' || alarm.severity === 'Critical'
              ? 'alarm'
              : alarm.severity === 'Warning'
                ? comp.status === 'alarm'
                  ? 'alarm'
                  : 'warning'
                : comp.status,
        };
      }
    }
  }

  return {
    ...state,
    components: updatedComponents,
    lastAlarmUpdate: alarms.timestamp,
    dataAgeSeconds:
      alarms.data_age_seconds != null ? Number(alarms.data_age_seconds) : null,
    dataStale: false,
  };
}

// --- Reducer ---

export function sldReducer(
  state: SldDiagramState,
  action: SldAction,
): SldDiagramState {
  switch (action.type) {
    case 'UPDATE_ALARMS':
      return applyAlarms(state, action.alarms);

    case 'TOGGLE_BREAKER': {
      const comp = state.components[action.componentId];
      if (!comp || comp.switchPosition === undefined) return state;
      return {
        ...state,
        components: {
          ...state.components,
          [action.componentId]: {
            ...comp,
            switchPosition:
              comp.switchPosition === 'closed' ? 'open' : 'closed',
          },
        },
      };
    }

    case 'SET_POWER_FLOW': {
      const wire = state.wires[action.wireId];
      if (!wire) return state;
      return {
        ...state,
        wires: {
          ...state.wires,
          [action.wireId]: {
            ...wire,
            powerFlow: action.direction,
          },
        },
      };
    }

    case 'MARK_STALE':
      return { ...state, dataStale: true };
  }
}

// --- Initial state factory ---

export function createInitialState(
  components: SldComponentState[],
  wires: SldWireState[],
): SldDiagramState {
  const componentMap: Record<string, SldComponentState> = {};
  for (const c of components) {
    componentMap[c.id] = c;
  }
  const wireMap: Record<string, SldWireState> = {};
  for (const w of wires) {
    wireMap[w.id] = w;
  }
  return {
    components: componentMap,
    wires: wireMap,
    lastAlarmUpdate: null,
    dataAgeSeconds: null,
    dataStale: false,
  };
}

/** Helper to create a component definition */
export function defComponent(
  id: string,
  zone: AlarmZoneDto,
  switchPosition?: 'open' | 'closed',
): SldComponentState {
  return {
    id,
    zone,
    status: 'normal',
    highestSeverity: null,
    activeAlarmCount: 0,
    activeAlarms: [],
    switchPosition,
  };
}

/** Helper to create a wire definition */
export function defWire(
  id: string,
  from: string,
  to: string,
): SldWireState {
  return {
    id,
    from,
    to,
    energized: true,
    powerFlow: 'none',
  };
}
