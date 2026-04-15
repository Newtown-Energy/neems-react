import React from 'react';
import type { AlarmZoneDto } from '@newtown-energy/types';
import type { SldDiagramState } from '../types';
import type { SldAction } from '../sldState';
import UtilityConnection from '../elements/UtilityConnection';
import Meter from '../elements/Meter';
import CircuitBreaker from '../elements/CircuitBreaker';
import Transformer from '../elements/Transformer';
import BusBar from '../elements/BusBar';
import Megapack from '../elements/Megapack';
import FireAlarmPanel from '../elements/FireAlarmPanel';
import Wire from '../elements/Wire';

/**
 * Zone-to-component ID mapping for the Newtown site.
 * This is site-specific -- future sites will have their own layouts.
 */
export const ZONE_TO_COMPONENT: Record<AlarmZoneDto, string> = {
  Site: 'site',
  BreakerRelay: 'breaker-main',
  Meter: 'meter-main',
  Transformer1: 'transformer-1',
  Transformer2: 'transformer-2',
  Rtac: 'rtac',
  Facp: 'fire-alarm-panel',
  TeslaSiteController: 'tesla-site-controller',
  Mp1a: 'megapack-1a',
  Mp1b: 'megapack-1b',
  Mp1c: 'megapack-1c',
  Mp2a: 'megapack-2a',
  Mp2b: 'megapack-2b',
  Mp2c: 'megapack-2c',
};

interface NewtownLayoutProps {
  state: SldDiagramState;
  dispatch: React.Dispatch<SldAction>;
}

// --- Layout coordinates ---
// SVG viewBox is 1200 x 800
// Topology flows top to bottom:
//   Utility -> Meter -> Main Breaker -> T1/T2 -> Bus Bar -> Feeder Breakers -> Megapacks

const CX = 600; // horizontal center
const UTIL_Y = 50;
const METER_Y = 110;
const MAIN_BRK_Y = 175;
const XFMR_Y = 260;
const XFMR_SPREAD = 160; // horizontal spread from center for T1/T2
const BUS_Y = 340;
const BUS_X = 200;
const BUS_WIDTH = 800;
const FEEDER_Y = 410;
const MEGA_Y = 510;
const FACP_X = 1080;
const FACP_Y = 260;

// Megapack columns: evenly space 6 megapacks across the bus bar
const megapackXPositions = [
  BUS_X + BUS_WIDTH * (1 / 12),
  BUS_X + BUS_WIDTH * (3 / 12),
  BUS_X + BUS_WIDTH * (5 / 12),
  BUS_X + BUS_WIDTH * (7 / 12),
  BUS_X + BUS_WIDTH * (9 / 12),
  BUS_X + BUS_WIDTH * (11 / 12),
];

const megapackIds = [
  'megapack-1a',
  'megapack-1b',
  'megapack-1c',
  'megapack-2a',
  'megapack-2b',
  'megapack-2c',
] as const;

const megapackLabels = ['Mp1a', 'Mp1b', 'Mp1c', 'Mp2a', 'Mp2b', 'Mp2c'];

const feederBreakerIds = [
  'feeder-1a',
  'feeder-1b',
  'feeder-1c',
  'feeder-2a',
  'feeder-2b',
  'feeder-2c',
] as const;

/**
 * Hardcoded layout for the Newtown BESS facility.
 * Places all SLD elements at fixed coordinates within the SVG viewBox.
 */
const NewtownLayout: React.FC<NewtownLayoutProps> = ({ state, dispatch }) => {
  const comp = (id: string) => state.components[id];
  const wire = (id: string) => state.wires[id];

  return (
    <>
      {/* === Wires (drawn first, behind components) === */}

      {/* Utility to Meter */}
      <Wire x1={CX} y1={UTIL_Y} x2={CX} y2={METER_Y - 14} state={wire('wire-util-meter')} />

      {/* Meter to Main Breaker */}
      <Wire x1={CX} y1={METER_Y + 14} x2={CX} y2={MAIN_BRK_Y - 10} state={wire('wire-meter-brk')} />

      {/* Main Breaker to T1 junction */}
      <Wire
        x1={CX}
        y1={MAIN_BRK_Y + 10}
        x2={CX - XFMR_SPREAD}
        y2={XFMR_Y - 24}
        state={wire('wire-brk-t1')}
        waypoints={[
          { x: CX, y: MAIN_BRK_Y + 30 },
          { x: CX - XFMR_SPREAD, y: MAIN_BRK_Y + 30 },
        ]}
      />

      {/* Main Breaker to T2 junction */}
      <Wire
        x1={CX}
        y1={MAIN_BRK_Y + 10}
        x2={CX + XFMR_SPREAD}
        y2={XFMR_Y - 24}
        state={wire('wire-brk-t2')}
        waypoints={[
          { x: CX, y: MAIN_BRK_Y + 30 },
          { x: CX + XFMR_SPREAD, y: MAIN_BRK_Y + 30 },
        ]}
      />

      {/* T1 to Bus Bar */}
      <Wire
        x1={CX - XFMR_SPREAD}
        y1={XFMR_Y + 24}
        x2={CX - XFMR_SPREAD}
        y2={BUS_Y}
        state={wire('wire-t1-bus')}
      />

      {/* T2 to Bus Bar */}
      <Wire
        x1={CX + XFMR_SPREAD}
        y1={XFMR_Y + 24}
        x2={CX + XFMR_SPREAD}
        y2={BUS_Y}
        state={wire('wire-t2-bus')}
      />

      {/* Feeder breaker wires: bus to breaker, breaker to megapack */}
      {megapackXPositions.map((mx, i) => (
        <React.Fragment key={`feeder-wires-${feederBreakerIds[i]}`}>
          {/* Bus to feeder breaker */}
          <Wire
            x1={mx}
            y1={BUS_Y}
            x2={mx}
            y2={FEEDER_Y - 10}
            state={wire(`wire-bus-feeder-${i}`)}
          />
          {/* Feeder breaker to megapack */}
          <Wire
            x1={mx}
            y1={FEEDER_Y + 10}
            x2={mx}
            y2={MEGA_Y - 24}
            state={wire(`wire-feeder-mega-${i}`)}
          />
        </React.Fragment>
      ))}

      {/* === Components (drawn on top of wires) === */}

      {/* Utility connection */}
      <UtilityConnection x={CX} y={UTIL_Y} state={comp('site')} label="UTILITY" />

      {/* Meter (SEL-735) */}
      <Meter x={CX} y={METER_Y} state={comp('meter-main')} label="SEL-735" />

      {/* Main Breaker (SEL-451) */}
      <CircuitBreaker
        x={CX}
        y={MAIN_BRK_Y}
        state={comp('breaker-main')}
        label="SEL-451"
        onClick={() => dispatch({ type: 'TOGGLE_BREAKER', componentId: 'breaker-main' })}
      />

      {/* Transformer 1 */}
      <Transformer
        x={CX - XFMR_SPREAD}
        y={XFMR_Y}
        state={comp('transformer-1')}
        label="T1"
      />

      {/* Transformer 2 */}
      <Transformer
        x={CX + XFMR_SPREAD}
        y={XFMR_Y}
        state={comp('transformer-2')}
        label="T2"
      />

      {/* Bus Bar */}
      <BusBar x={BUS_X} y={BUS_Y} width={BUS_WIDTH} label="MAIN BUS" />

      {/* Feeder Breakers + Megapacks */}
      {megapackXPositions.map((mx, i) => (
        <React.Fragment key={`feeder-${feederBreakerIds[i]}`}>
          <CircuitBreaker
            x={mx}
            y={FEEDER_Y}
            state={comp(feederBreakerIds[i])}
            label={`CB${i + 1}`}
            onClick={() =>
              dispatch({ type: 'TOGGLE_BREAKER', componentId: feederBreakerIds[i] })
            }
          />
          <Megapack
            x={mx}
            y={MEGA_Y}
            state={comp(megapackIds[i])}
            label={megapackLabels[i]}
          />
        </React.Fragment>
      ))}

      {/* Fire Alarm Panel */}
      <FireAlarmPanel x={FACP_X} y={FACP_Y} state={comp('fire-alarm-panel')} />

      {/* FACP connecting line (dashed, not part of power flow) */}
      <line
        x1={FACP_X - 25}
        y1={FACP_Y}
        x2={CX + XFMR_SPREAD + 40}
        y2={FACP_Y}
        stroke="#888"
        strokeWidth={1}
        strokeDasharray="6 3"
      />
    </>
  );
};

export default NewtownLayout;
