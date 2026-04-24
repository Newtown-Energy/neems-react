import React from 'react';
import type { AlarmZoneDto } from '@newtown-energy/types';
import type { SldDiagramState, SwitchVisualState } from '../types';
import type { SldAction } from '../sldState';
import UtilityConnection from '../elements/UtilityConnection';
import Meter from '../elements/Meter';
import CircuitBreaker from '../elements/CircuitBreaker';
import Transformer from '../elements/Transformer';
import BusBar from '../elements/BusBar';
import Megapack from '../elements/Megapack';
import FireAlarmPanel from '../elements/FireAlarmPanel';
import Switch from '../elements/Switch';
import Sel451Relay from '../elements/Sel451Relay';
import LockoutRelay from '../elements/LockoutRelay';
import EStopButton from '../elements/EStopButton';
import Wire from '../elements/Wire';
import { SITE_CONFIG } from '../../../config/siteConfig';

/**
 * Zone-to-component ID mapping for the Newtown site. Several SLD components
 * share a zone because the backend publishes alarms at a coarser granularity
 * than the diagram. E.g. both line switches compose their visual state from
 * the BreakerRelay and Facp zones rather than having dedicated zones.
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
  /** Called when the E-stop button is clicked. Owner displays the confirm dialog. */
  onEStopClicked: () => void;
}

// --- Layout coordinates (viewBox 1200x800) ---
// Top→bottom flow:
//   Utility ─┐
//            Meter─(CT tap)─┼─────── 26.4 kV bus ────────┐
//                          89L-1                       89L-2
//                           T1                           T2
//                           ├── 480V Bus 1 ──┤    ├── 480V Bus 2 ──┤
//                        feeders + megapacks      feeders + megapacks
//                   SEL-451 relay sits off the power path, with dashed
//                   control lines to each switch.

const UTIL_X = 200;
const UTIL_Y = 60;
const METER_X = 100;
const METER_Y = 140;
const BUS_26KV_Y = 240;
const BUS_26KV_X = 140;
const BUS_26KV_WIDTH = 920;
const SW_L_X = 390;
const SW_R_X = 870;
const SW_Y = 290;
const XFMR_Y = 380;
const BUS_480_Y = 470;
const BUS_480_WIDTH = 420;
const BUS_480_L_X = 180;
const BUS_480_R_X = 660;
const FEEDER_Y = 550;
const MEGA_Y = 660;
const SEL451_X = 630;
const SEL451_Y = 360;
// Lockout relay — between SEL-451 and FACP, off the power path so the dashed
// control line from the SEL-451 reads clearly.
const LOCKOUT_X = 870;
const LOCKOUT_Y = 400;
const FACP_X = 1130;
const FACP_Y = 440;
const ESTOP_X = 1110;
const ESTOP_Y = 100;

// Feeder breaker X-positions within each 480V bus
const BUS1_FEEDER_X = [250, 390, 530];
const BUS2_FEEDER_X = [730, 870, 1010];

const megapackIds = [
  'megapack-1a',
  'megapack-1b',
  'megapack-1c',
  'megapack-2a',
  'megapack-2b',
  'megapack-2c',
] as const;

const megapackLabels = ['MP-1A', 'MP-1B', 'MP-1C', 'MP-2A', 'MP-2B', 'MP-2C'];

const feederBreakerIds = [
  'feeder-1a',
  'feeder-1b',
  'feeder-1c',
  'feeder-2a',
  'feeder-2b',
  'feeder-2c',
] as const;

/**
 * Compose the visual state of a knife switch from adjacent alarm sources.
 * The derived `locked-out` state forces the switch to render grey + open,
 * mirroring how physical lockout interlocks behave.
 */
function computeSwitchVisualState(
  state: SldDiagramState,
  switchId: string,
): SwitchVisualState {
  if (state.operationalMode === 'e-stop-active') return 'locked-out';
  if (state.components['fire-alarm-panel']?.status === 'alarm') return 'locked-out';
  const hasLockout = state.components['breaker-main']?.activeAlarms.some((a) =>
    a.name.toLowerCase().includes('lockout'),
  );
  if (hasLockout) return 'locked-out';
  const pos = state.components[switchId]?.switchPosition;
  return pos === 'open' ? 'open' : 'closed';
}

const NewtownLayout: React.FC<NewtownLayoutProps> = ({
  state,
  dispatch,
  onEStopClicked,
}) => {
  const comp = (id: string) => state.components[id];
  const wire = (id: string) => state.wires[id];

  const sw1Visual = computeSwitchVisualState(state, 'switch-89l-1');
  const sw2Visual = computeSwitchVisualState(state, 'switch-89l-2');

  const busFeederPairs: Array<{
    feederX: number[];
    busX: number;
    busEndX: number;
    transformerX: number;
    feederOffset: number;
  }> = [
    {
      feederX: BUS1_FEEDER_X,
      busX: BUS_480_L_X,
      busEndX: BUS_480_L_X + BUS_480_WIDTH,
      transformerX: SW_L_X,
      feederOffset: 0,
    },
    {
      feederX: BUS2_FEEDER_X,
      busX: BUS_480_R_X,
      busEndX: BUS_480_R_X + BUS_480_WIDTH,
      transformerX: SW_R_X,
      feederOffset: 3,
    },
  ];

  return (
    <>
      {/* === Wires (drawn first, behind components) === */}

      {/* Utility → 26.4 kV bus */}
      <Wire
        x1={UTIL_X}
        y1={UTIL_Y}
        x2={UTIL_X}
        y2={BUS_26KV_Y}
        state={wire('wire-util-bus')}
      />

      {/* 26.4 kV bus → 89L-1 */}
      <Wire
        x1={SW_L_X}
        y1={BUS_26KV_Y}
        x2={SW_L_X}
        y2={SW_Y - 18}
        state={wire('wire-bus26-sw1')}
      />
      {/* 26.4 kV bus → 89L-2 */}
      <Wire
        x1={SW_R_X}
        y1={BUS_26KV_Y}
        x2={SW_R_X}
        y2={SW_Y - 18}
        state={wire('wire-bus26-sw2')}
      />

      {/* 89L-1 → T1 */}
      <Wire
        x1={SW_L_X}
        y1={SW_Y + 18}
        x2={SW_L_X}
        y2={XFMR_Y - 24}
        state={wire('wire-sw1-t1')}
      />
      {/* 89L-2 → T2 */}
      <Wire
        x1={SW_R_X}
        y1={SW_Y + 18}
        x2={SW_R_X}
        y2={XFMR_Y - 24}
        state={wire('wire-sw2-t2')}
      />

      {/* T1 → 480V Bus 1 */}
      <Wire
        x1={SW_L_X}
        y1={XFMR_Y + 24}
        x2={SW_L_X}
        y2={BUS_480_Y}
        state={wire('wire-t1-bus480-1')}
      />
      {/* T2 → 480V Bus 2 */}
      <Wire
        x1={SW_R_X}
        y1={XFMR_Y + 24}
        x2={SW_R_X}
        y2={BUS_480_Y}
        state={wire('wire-t2-bus480-2')}
      />

      {/* SEL-451 control lines (dashed) */}
      <Wire
        x1={SEL451_X - 55}
        y1={SEL451_Y}
        x2={SW_L_X + 12}
        y2={SW_Y}
        state={wire('wire-sel-sw1')}
        waypoints={[
          { x: SEL451_X - 100, y: SEL451_Y },
          { x: SEL451_X - 100, y: SW_Y },
        ]}
        control
      />
      <Wire
        x1={SEL451_X + 55}
        y1={SEL451_Y}
        x2={SW_R_X - 12}
        y2={SW_Y}
        state={wire('wire-sel-sw2')}
        waypoints={[
          { x: SEL451_X + 100, y: SEL451_Y },
          { x: SEL451_X + 100, y: SW_Y },
        ]}
        control
      />

      {/* SEL-451 → lockout relay (dashed control) */}
      {SITE_CONFIG.sld.showLockoutRelay && (
        <Wire
          x1={SEL451_X + 55}
          y1={SEL451_Y}
          x2={LOCKOUT_X}
          y2={LOCKOUT_Y - 20}
          state={wire('wire-sel-lockout')}
          waypoints={[{ x: LOCKOUT_X, y: SEL451_Y }]}
          control
        />
      )}

      {/* FACP supervision line (dashed control) */}
      <Wire
        x1={FACP_X - 28}
        y1={FACP_Y}
        x2={SW_R_X}
        y2={FACP_Y}
        state={wire('wire-facp')}
        control
      />

      {/* Feeder wires: 480V bus → feeder breaker → megapack */}
      {busFeederPairs.flatMap((pair) =>
        pair.feederX.map((fx, i) => {
          const feederIdx = pair.feederOffset + i;
          return (
            <React.Fragment key={`feeder-wires-${feederIdx}`}>
              <Wire
                x1={fx}
                y1={BUS_480_Y}
                x2={fx}
                y2={FEEDER_Y - 20}
                state={wire(`wire-bus480-feeder-${feederIdx}`)}
              />
              <Wire
                x1={fx}
                y1={FEEDER_Y + 20}
                x2={fx}
                y2={MEGA_Y - 27}
                state={wire(`wire-feeder-mega-${feederIdx}`)}
              />
            </React.Fragment>
          );
        }),
      )}

      {/* === Buses (above components so junction dots sit on top) === */}
      <BusBar
        x={BUS_26KV_X}
        y={BUS_26KV_Y}
        width={BUS_26KV_WIDTH}
        label="26.4 kV Bus"
        nodes={[UTIL_X, SW_L_X, SW_R_X]}
      />
      <BusBar
        x={BUS_480_L_X}
        y={BUS_480_Y}
        width={BUS_480_WIDTH}
        label="480 V Bus 1"
        nodes={[SW_L_X, ...BUS1_FEEDER_X]}
      />
      <BusBar
        x={BUS_480_R_X}
        y={BUS_480_Y}
        width={BUS_480_WIDTH}
        label="480 V Bus 2"
        nodes={[SW_R_X, ...BUS2_FEEDER_X]}
      />

      {/* === Components === */}

      {/* Utility connection */}
      <UtilityConnection x={UTIL_X} y={UTIL_Y} state={comp('site')} label="Utility" />

      {/* Meter (SEL-735 with CT tap at main line) */}
      <Meter
        x={METER_X}
        y={METER_Y}
        state={comp('meter-main')}
        label="MT1"
        secondaryLabel="SEL-735"
        tapToX={UTIL_X}
      />

      {/* Line switches */}
      <Switch
        x={SW_L_X}
        y={SW_Y}
        state={comp('switch-89l-1')}
        visualState={sw1Visual}
        label="89L-1"
        onClick={() => {
          const cur = comp('switch-89l-1').switchPosition;
          dispatch({
            type: 'SET_SWITCH_POSITION',
            componentId: 'switch-89l-1',
            position: cur === 'closed' ? 'open' : 'closed',
          });
        }}
      />
      <Switch
        x={SW_R_X}
        y={SW_Y}
        state={comp('switch-89l-2')}
        visualState={sw2Visual}
        label="89L-2"
        onClick={() => {
          const cur = comp('switch-89l-2').switchPosition;
          dispatch({
            type: 'SET_SWITCH_POSITION',
            componentId: 'switch-89l-2',
            position: cur === 'closed' ? 'open' : 'closed',
          });
        }}
      />

      {/* Transformers */}
      <Transformer x={SW_L_X} y={XFMR_Y} state={comp('transformer-1')} label="T1" />
      <Transformer x={SW_R_X} y={XFMR_Y} state={comp('transformer-2')} label="T2" />

      {/* Feeder breakers + megapacks */}
      {busFeederPairs.flatMap((pair) =>
        pair.feederX.map((fx, i) => {
          const feederIdx = pair.feederOffset + i;
          const mpLabel = megapackLabels[feederIdx];
          return (
            <React.Fragment key={`feeder-${feederIdx}`}>
              <CircuitBreaker
                x={fx}
                y={FEEDER_Y}
                state={comp(feederBreakerIds[feederIdx])}
                label={`52-${mpLabel}`}
                onClick={() =>
                  dispatch({
                    type: 'TOGGLE_BREAKER',
                    componentId: feederBreakerIds[feederIdx],
                  })
                }
              />
              <Megapack
                x={fx}
                y={MEGA_Y}
                state={comp(megapackIds[feederIdx])}
                label={mpLabel}
              />
            </React.Fragment>
          );
        }),
      )}

      {/* SEL-451 relay (off the power path) */}
      <Sel451Relay x={SEL451_X} y={SEL451_Y} state={comp('breaker-main')} />

      {/* Lockout relay — driven by the SEL-451 via a dashed control line */}
      {SITE_CONFIG.sld.showLockoutRelay && (
        <LockoutRelay
          x={LOCKOUT_X}
          y={LOCKOUT_Y}
          state={comp('lockout-relay')}
          onClick={
            SITE_CONFIG.lockout.remoteTriggerEnabled
              ? () => {
                  const cur = comp('lockout-relay').switchPosition;
                  dispatch({
                    type: 'SET_SWITCH_POSITION',
                    componentId: 'lockout-relay',
                    position: cur === 'closed' ? 'open' : 'closed',
                  });
                }
              : undefined
          }
        />
      )}

      {/* Fire Alarm Panel */}
      <FireAlarmPanel x={FACP_X} y={FACP_Y} state={comp('fire-alarm-panel')} />

      {/* E-stop button */}
      <EStopButton
        x={ESTOP_X}
        y={ESTOP_Y}
        active={state.operationalMode === 'e-stop-active'}
        onClick={onEStopClicked}
      />
    </>
  );
};

export default NewtownLayout;
