import type { ActiveAlarmsResponse, AlarmSeverityDto, AlarmZoneDto } from '@newtown-energy/types';
import { getSeverityOrder } from '../../utils/alarmHelpers';
import { resolveAlarmSeverity } from '../../config/siteConfig';
import type {
  ActiveAlarmSummary,
  SldBorderState,
  SldComponentState,
  SldDiagramState,
  SldWireState,
  PowerFlowDirection,
} from './types';

/** Spreadsheet token for the main-pane border/frame (not a diagram component). */
const BORDER_TOKEN = 'Border';

/** Alarm zone of the fire alarm panel — drives the red life-safety frame. */
const FIRE_ZONE: AlarmZoneDto = 'Facp';

function zoneIds(
  components: Record<string, SldComponentState>,
  zone: SldComponentState['zone'],
): string[] {
  return Object.values(components)
    .filter((c) => c.zone === zone)
    .map((c) => c.id);
}

/**
 * Resolve which component ids an active alarm should light up. Prefers explicit
 * "Related SLD Object" token targeting (matching `alarm.sld_targets` against
 * each component's `sldTokens`); falls back to zone matching when the alarm's
 * tokens correspond to no component yet (e.g. `Net`, `M1`/`M2`, `SST-UPS`).
 */
function resolveAlarmTargets(
  components: Record<string, SldComponentState>,
  zone: SldComponentState['zone'],
  sldTargets: string[],
): string[] {
  const tokens = sldTargets.filter((t) => t !== BORDER_TOKEN);
  if (tokens.length > 0) {
    const matched = Object.values(components)
      .filter((c) => c.sldTokens?.some((t) => tokens.includes(t)))
      .map((c) => c.id);
    if (matched.length > 0) return matched;
    // Tokens present but mapping to no element yet (e.g. `Net`, `M1`/`M2`,
    // `SST-UPS`) — fall back to lighting the whole zone.
    return zoneIds(components, zone);
  }
  // The only target was the pane border: a frame-only/site-level alarm. Don't
  // spill it onto every component in the zone.
  if (sldTargets.includes(BORDER_TOKEN)) return [];
  // Truly untargeted alarm — fall back to zone matching.
  return zoneIds(components, zone);
}

// --- Actions ---

export type SldAction =
  | { type: 'UPDATE_ALARMS'; alarms: ActiveAlarmsResponse }
  | { type: 'TOGGLE_BREAKER'; componentId: string }
  | { type: 'SET_SWITCH_POSITION'; componentId: string; position: 'open' | 'closed' }
  | { type: 'SET_ESTOP_ACTIVE'; active: boolean }
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

  // Route each alarm to its target component(s) and fold in the main-pane
  // border state. The frame is raised by alarms that target the `Border` SLD
  // object (the spreadsheet's "site not ready to operate" controls faults) and
  // by a fire / life-safety emergency in the FACP zone. Its color tracks the
  // highest severity among those triggering alarms — matching the alarm-badge
  // palette — so a critical fault reads red/orange, not an unintuitive blue.
  let borderSeverity: AlarmSeverityDto | null = null;

  for (const alarm of alarms.alarms) {
    // Apply any per-site alarm-level override before computing severity-driven state.
    const severity = resolveAlarmSeverity(alarm.alarm_num, alarm.severity);
    const sldTargets = alarm.sld_targets ?? [];

    const alarmSummary: ActiveAlarmSummary = {
      alarm_num: alarm.alarm_num,
      name: alarm.name,
      severity,
      message: alarm.message ?? null,
    };

    const raisesBorder =
      sldTargets.includes(BORDER_TOKEN) ||
      (severity === 'Emergency' && alarm.zone === FIRE_ZONE);
    if (
      raisesBorder &&
      (borderSeverity === null ||
        getSeverityOrder(severity) < getSeverityOrder(borderSeverity))
    ) {
      borderSeverity = severity;
    }

    const targetIds = resolveAlarmTargets(updatedComponents, alarm.zone, sldTargets);
    for (const id of targetIds) {
      const comp = updatedComponents[id];
      const currentOrder = comp.highestSeverity
        ? getSeverityOrder(comp.highestSeverity)
        : Infinity;
      const newOrder = getSeverityOrder(severity);

      updatedComponents[id] = {
        ...comp,
        activeAlarmCount: comp.activeAlarmCount + 1,
        activeAlarms: [...comp.activeAlarms, alarmSummary],
        highestSeverity:
          newOrder < currentOrder ? severity : comp.highestSeverity,
        status:
          severity === 'Emergency' || severity === 'Critical'
            ? 'alarm'
            : severity === 'Warning'
              ? comp.status === 'alarm'
                ? 'alarm'
                : 'warning'
              : comp.status,
      };
    }
  }

  const border: SldBorderState = borderSeverity ? { severity: borderSeverity } : null;

  return {
    ...state,
    components: updatedComponents,
    border,
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

    case 'SET_SWITCH_POSITION': {
      const comp = state.components[action.componentId];
      if (!comp || comp.switchPosition === undefined) return state;
      return {
        ...state,
        components: {
          ...state.components,
          [action.componentId]: {
            ...comp,
            switchPosition: action.position,
          },
        },
      };
    }

    case 'SET_ESTOP_ACTIVE':
      return {
        ...state,
        operationalMode: action.active ? 'e-stop-active' : 'normal',
      };

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
    border: null,
    lastAlarmUpdate: null,
    dataAgeSeconds: null,
    dataStale: false,
    operationalMode: 'normal',
  };
}

/** Helper to create a component definition */
export function defComponent(
  id: string,
  zone: AlarmZoneDto,
  switchPosition?: 'open' | 'closed',
  sldTokens?: string[],
): SldComponentState {
  return {
    id,
    zone,
    sldTokens,
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
