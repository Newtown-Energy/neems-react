import React from 'react';
import type { SldLayoutProps } from '../../components/SingleLineDiagram/layoutProps';
import type { SldDiagramState, SwitchVisualState } from '../../components/SingleLineDiagram/types';
import UtilityConnection from '../../components/SingleLineDiagram/elements/UtilityConnection';
import Meter from '../../components/SingleLineDiagram/elements/Meter';
import CircuitBreaker from '../../components/SingleLineDiagram/elements/CircuitBreaker';
import Transformer from '../../components/SingleLineDiagram/elements/Transformer';
import BusBar from '../../components/SingleLineDiagram/elements/BusBar';
import Megapack from '../../components/SingleLineDiagram/elements/Megapack';
import FireAlarmPanel from '../../components/SingleLineDiagram/elements/FireAlarmPanel';
import Switch from '../../components/SingleLineDiagram/elements/Switch';
import Sel451Relay from '../../components/SingleLineDiagram/elements/Sel451Relay';
import LockoutRelay from '../../components/SingleLineDiagram/elements/LockoutRelay';
import EmergencyShutdownButton from '../../components/SingleLineDiagram/elements/EmergencyShutdownButton';
import EStopIndicator from '../../components/SingleLineDiagram/elements/EStopIndicator';
import Wire from '../../components/SingleLineDiagram/elements/Wire';
import SiteInfoPanel from '../../components/SingleLineDiagram/elements/SiteInfoPanel';
import { useSiteConfig } from '../../config/siteConfig';
import { PROJECT_INFO } from './diagram';

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
// Lockout relay — directly below the SEL-451 relay, in the clear gap between
// the two 480V buses, so it stays off the power path and the dashed control
// line from the SEL-451 drops straight down to it. (Previously sat at x=870,
// overlapping the right line switch / transformer T2.)
const LOCKOUT_X = 630;
const LOCKOUT_Y = 420;
// Site identity block — in the empty band right of the utility label box
// (which ends at x=318) and above the 26.4 kV bus, laid out wide and short
// so it uses space the one-line drawing never needs.
const SITE_INFO_X = 400;
const SITE_INFO_Y = 30;
const SITE_INFO_WIDTH = 530;
const FACP_X = 1130;
const FACP_Y = 440;
// Emergency Shutdown button in the top-right corner, with the site's E-stop
// state directly beneath it: in the clear band right of the site info block
// and above the 26.4 kV bus, which ends at x=1060.
const SHUTDOWN_X = 1110;
const SHUTDOWN_Y = 90;
const ESTOP_INDICATOR_X = 1110;
const ESTOP_INDICATOR_Y = 190;

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
  // `unknown` is carried through rather than collapsed: a switch we have no
  // reading for must not be drawn as closed just because it is not open.
  if (pos === 'unknown' || pos === undefined) return 'unknown';
  return pos === 'open' ? 'open' : 'closed';
}

const NewtownLayout: React.FC<SldLayoutProps> = ({
  state,
  onEmergencyShutdownClicked,
  emergencyShutdownPending = false,
  eStopState,
  onControlRequested,
  controlRequestFor,
  controlActionFor,
}) => {
  const comp = (id: string) => state.components[id];
  const wire = (id: string) => state.wires[id];
  const siteConfig = useSiteConfig();

  /**
   * The click handler for one control, or `undefined` when the backend offers
   * no action for it — which leaves the element inert rather than sending a
   * request that would be refused.
   */
  const clickFor = (controlId: string): (() => void) | undefined => {
    const action = controlActionFor(controlId, comp(controlId)?.switchPosition);
    return action ? () => onControlRequested(controlId, action) : undefined;
  };

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

      {/* SEL-451 → lockout relay (dashed control, straight drop below the relay) */}
      {siteConfig.sld.showLockoutRelay && (
        <Wire
          x1={SEL451_X}
          y1={SEL451_Y + 26}
          x2={LOCKOUT_X}
          y2={LOCKOUT_Y - 20}
          state={wire('wire-sel-lockout')}
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

      {/* Site identity, in the open band right of the utility feed */}
      <SiteInfoPanel x={SITE_INFO_X} y={SITE_INFO_Y} width={SITE_INFO_WIDTH} info={PROJECT_INFO} />

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
        request={controlRequestFor('switch-89l-1')}
        onClick={clickFor('switch-89l-1')}
      />
      <Switch
        x={SW_R_X}
        y={SW_Y}
        state={comp('switch-89l-2')}
        visualState={sw2Visual}
        label="89L-2"
        request={controlRequestFor('switch-89l-2')}
        onClick={clickFor('switch-89l-2')}
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
                request={controlRequestFor(feederBreakerIds[feederIdx])}
                onClick={clickFor(feederBreakerIds[feederIdx])}
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
      {siteConfig.sld.showLockoutRelay && (
        <LockoutRelay
          x={LOCKOUT_X}
          y={LOCKOUT_Y}
          state={comp('lockout-relay')}
          request={controlRequestFor('lockout-relay')}
          // Trip only — that is what the backend offers for this control, so
          // the shared derivation reaches it without the layout hardcoding it.
          onClick={
            siteConfig.lockout.remoteTriggerEnabled ? clickFor('lockout-relay') : undefined
          }
        />
      )}

      {/* Fire Alarm Panel */}
      <FireAlarmPanel x={FACP_X} y={FACP_Y} state={comp('fire-alarm-panel')} />

      {/* Emergency Shutdown request — asks the site to shut down */}
      <EmergencyShutdownButton
        x={SHUTDOWN_X}
        y={SHUTDOWN_Y}
        eStopActive={state.operationalMode === 'e-stop-active'}
        pending={emergencyShutdownPending}
        onClick={onEmergencyShutdownClicked}
      />

      {/* The site's physical E-stop, as reported by alarm 104 */}
      <EStopIndicator
        x={ESTOP_INDICATOR_X}
        y={ESTOP_INDICATOR_Y}
        state={eStopState}
      />
    </>
  );
};

export default NewtownLayout;
