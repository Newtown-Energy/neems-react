import type { AlarmSeverityDto, AlarmStatusDto, AlarmZoneDto } from '@newtown-energy/types';

/** Summary of a single active alarm on a component */
export interface ActiveAlarmSummary {
  /** Stable alarm identifier — matches AlarmDefinitionDto.alarm_num. Needed
   *  by the acknowledgement system to key ack state by alarm. */
  alarm_num: number;
  name: string;
  severity: AlarmSeverityDto;
  /** Operator-facing message from the alarm spreadsheet ("Mouseover").
   *  `null` when the spreadsheet had none — callers fall back to the name. */
  message: string | null;
  /** Server-authoritative acknowledgement status. `Active` = unacked and
   *  firing now; `AcknowledgedActive` = acked but still firing;
   *  `ReturnedUnacknowledged` = no longer firing but latched awaiting ack. */
  status: AlarmStatusDto;
  /** Raw current data state, independent of acknowledgement. `false` for a
   *  returned-to-normal alarm still latched awaiting acknowledgement. */
  dataActive: boolean;
  /** Email of the most recent acknowledger, for display; `null` if unacked. */
  acknowledgedByEmail: string | null;
  /** ISO 8601 timestamp of the most recent acknowledgement; `null` if unacked. */
  acknowledgedAt: string | null;
}

/** The visual state of a single SLD component */
export type ComponentStatus = 'normal' | 'alarm' | 'warning' | 'offline';

/** Switch/breaker position */
export type SwitchPosition = 'open' | 'closed';

/**
 * Derived visual state for knife-switch-style elements.
 * `locked-out` forces the switch to render grey + open regardless of `switchPosition`
 * (used for E-stop, fire alarm, lockout relay).
 */
export type SwitchVisualState = 'closed' | 'open' | 'locked-out';

/** Site-level operational mode driven by E-stop */
export type OperationalMode = 'normal' | 'e-stop-active';

/** Direction of active power flow on a wire */
export type PowerFlowDirection = 'forward' | 'reverse' | 'none';

/** State for one SLD node (one physical piece of equipment) */
export interface SldComponentState {
  id: string;
  zone: AlarmZoneDto;
  /**
   * "Related SLD Object" tokens this component represents (e.g. `'52-MAIN-1'`,
   * `'LOR'`, `'Relay'`). An alarm whose `sld_targets` intersect these tokens is
   * routed to this component — finer than zone matching. Omitted = match by
   * zone only.
   */
  sldTokens?: string[];
  status: ComponentStatus;
  highestSeverity: AlarmSeverityDto | null;
  activeAlarmCount: number;
  activeAlarms: ActiveAlarmSummary[];
  switchPosition?: SwitchPosition;
  /**
   * Optional live analog/digital values keyed by a caller-defined name
   * (e.g. 'kW', 'kVar', 'voltage', 'amps', 'soc', 'stackTemp').
   * `null` means "slot exists but no data yet" — rendered as `--`.
   */
  analogs?: Record<string, number | null>;
}

/** State for a wire/connection */
export interface SldWireState {
  id: string;
  from: string;
  to: string;
  energized: boolean;
  powerFlow: PowerFlowDirection;
}

/**
 * Main-pane border state. Driven by alarms that target the `'Border'` SLD object
 * (the spreadsheet's "site not ready to operate" controls faults) plus a fire /
 * life-safety emergency in the FACP zone. The frame is colored by the highest
 * severity among those triggering alarms, matching the alarm-badge palette, so a
 * critical fault reads red/orange rather than an unintuitive blue. `null` = no
 * frame.
 */
export type SldBorderState = { severity: AlarmSeverityDto } | null;

/** Top-level diagram state */
export interface SldDiagramState {
  components: Record<string, SldComponentState>;
  wires: Record<string, SldWireState>;
  /** Main-pane border overlay driven by `'Border'`-targeted alarms. */
  border: SldBorderState;
  lastAlarmUpdate: string | null;
  dataAgeSeconds: number | null;
  dataStale: boolean;
  operationalMode: OperationalMode;
}

/** Common props for all SVG element components */
export interface SldElementProps {
  x: number;
  y: number;
  state: SldComponentState;
  label?: string;
  onClick?: () => void;
}

/** Props for wire elements */
export interface SldWireProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  state: SldWireState;
  /** Optional waypoints for polyline routing */
  waypoints?: Array<{ x: number; y: number }>;
}
