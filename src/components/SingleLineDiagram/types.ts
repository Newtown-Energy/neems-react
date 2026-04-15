import type { AlarmSeverityDto, AlarmZoneDto } from '@newtown-energy/types';

/** Summary of a single active alarm on a component */
export interface ActiveAlarmSummary {
  name: string;
  severity: AlarmSeverityDto;
}

/** The visual state of a single SLD component */
export type ComponentStatus = 'normal' | 'alarm' | 'warning' | 'offline';

/** Switch/breaker position */
export type SwitchPosition = 'open' | 'closed';

/** Direction of active power flow on a wire */
export type PowerFlowDirection = 'forward' | 'reverse' | 'none';

/** State for one SLD node (one physical piece of equipment) */
export interface SldComponentState {
  id: string;
  zone: AlarmZoneDto;
  status: ComponentStatus;
  highestSeverity: AlarmSeverityDto | null;
  activeAlarmCount: number;
  activeAlarms: ActiveAlarmSummary[];
  switchPosition?: SwitchPosition;
}

/** State for a wire/connection */
export interface SldWireState {
  id: string;
  from: string;
  to: string;
  energized: boolean;
  powerFlow: PowerFlowDirection;
}

/** Top-level diagram state */
export interface SldDiagramState {
  components: Record<string, SldComponentState>;
  wires: Record<string, SldWireState>;
  lastAlarmUpdate: string | null;
  dataAgeSeconds: number | null;
  dataStale: boolean;
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
