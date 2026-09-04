import type {
  ActiveAlarmsResponse,
  AlarmSeverityDto,
  AlarmZoneDto,
  LatestAnalogsResponse,
  ZoneAnalogs,
} from '@newtown-energy/types';
import { getSeverityOrder } from '../../utils/alarmHelpers';
import { ESTOP_ALARM_NUM } from '../../utils/estopApi';
import { resolveAlarmSeverity } from '../../config/siteConfig';
import { derivePositions, readbackUsable } from './readbackPositions';
import type {
  ActiveAlarmSummary,
  OperationalMode,
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

/**
 * API field name -> the display slot the SLD elements read.
 *
 * The wire format uses the client spreadsheet's names (`state_of_energy`) and
 * the elements use display names (`soc`); this table is the seam between them.
 * Keeping them distinct is deliberate — the backend stays checkable against the
 * client spec, and renaming a gauge here does not mean renaming a wire field.
 */
const ANALOG_FIELD_TO_SLOT = {
  state_of_energy: 'soc',
  max_battery_temperature: 'stackTemp',
  ac_voltage: 'outputVoltage',
} as const;

/**
 * Turn one zone's payload into the element's analog slots.
 *
 * A field the API reported as `null` is carried through as `null` rather than
 * dropped: the slot exists but has no reading, which the elements render as
 * `--`. Omitting the key entirely would look identical, but `null` says it
 * explicitly and keeps the slot list stable between polls.
 */
function slotsForZone(zone: ZoneAnalogs): Record<string, number | null> {
  // Named through the table above rather than by repeating the slot names,
  // so renaming a slot cannot leave the mapping and the assignment disagreeing.
  // These come from the top-level fields, which are present even on readings
  // stored before the raw register block was kept.
  const slots: Record<string, number | null> = {
    [ANALOG_FIELD_TO_SLOT.state_of_energy]: zone.state_of_energy,
    [ANALOG_FIELD_TO_SLOT.max_battery_temperature]: zone.max_battery_temperature,
    [ANALOG_FIELD_TO_SLOT.ac_voltage]: zone.ac_voltage,
  };
  // Everything else in the block, under its spreadsheet name, so an element
  // can start showing a measurement without another round through the API.
  for (const point of zone.points) {
    if (point.name in ANALOG_FIELD_TO_SLOT) continue;
    slots[point.name] = point.value;
  }
  return slots;
}

// --- Actions ---

export type SldAction =
  | { type: 'UPDATE_ALARMS'; alarms: ActiveAlarmsResponse }
  | { type: 'SET_POWER_FLOW'; wireId: string; direction: PowerFlowDirection }
  | { type: 'UPDATE_ANALOGS'; analogs: LatestAnalogsResponse }
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
      dataActive: alarm.data_active,
      acknowledged: alarm.acknowledged,
      acknowledgedByEmail: alarm.acknowledged_by_email ?? null,
      acknowledgedAt: alarm.acknowledged_at ?? null,
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

  // E-stop is read from the site, never authored here. Alarm 104 is what the
  // RTAC raises when the site is tripped, so the diagram's operational mode
  // follows it directly — the same update that lights the alarm also locks the
  // switches out, keeping the two from ever disagreeing.
  const operationalMode: OperationalMode = alarms.alarms.some(
    (a) => a.alarm_num === ESTOP_ALARM_NUM,
  )
    ? 'e-stop-active'
    : 'normal';

  // Switch and breaker positions come from the site's own readback points, on
  // the same update that lights the alarms — so the position drawn and the
  // alarms drawn can never disagree about which reading they came from. When
  // the feed is too old to trust, every position reads `unknown` rather than
  // falling back to whatever it last was.
  const dataAgeSeconds =
    alarms.data_age_seconds != null ? Number(alarms.data_age_seconds) : null;
  const activeAlarmNums = new Set(alarms.alarms.map((a) => a.alarm_num));
  const positions = derivePositions(
    activeAlarmNums,
    readbackUsable(dataAgeSeconds, false),
  );
  for (const [id, position] of Object.entries(positions)) {
    const comp = updatedComponents[id];
    if (comp) updatedComponents[id] = { ...comp, switchPosition: position };
  }

  return {
    ...state,
    components: updatedComponents,
    border,
    operationalMode,
    lastAlarmUpdate: alarms.timestamp,
    dataAgeSeconds,
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

    case 'UPDATE_ANALOGS': {
      const updated: Record<string, SldComponentState> = { ...state.components };
      for (const [zone, values] of Object.entries(action.analogs.zones)) {
        if (!values) continue;
        const slots = slotsForZone(values);
        // Routed by the component's own zone rather than a layout's
        // zone-to-id table: that keeps the reducer independent of any
        // particular diagram, and matches how alarms already find their
        // targets. A zone the diagram does not draw yields no ids and is
        // skipped — the API reports the site, not this layout.
        for (const id of zoneIds(state.components, zone as AlarmZoneDto)) {
          updated[id] = { ...updated[id], analogs: slots };
        }
      }
      return { ...state, components: updated };
    }

    case 'MARK_STALE': {
      // A failed poll is not evidence that anything is still where we last saw
      // it. Positions go unknown with the feed; alarms are left alone, since
      // the last-known alarm list is still the last thing the site said.
      const components: Record<string, SldComponentState> = {};
      for (const [id, comp] of Object.entries(state.components)) {
        components[id] =
          comp.switchPosition === undefined ? comp : { ...comp, switchPosition: 'unknown' };
      }
      return { ...state, components, dataStale: true };
    }
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
