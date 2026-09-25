// Newtown's single line diagram: the elements it tracks, the wires between
// them, where each control's position is read from, and the site identity it
// shows. The drawing itself is ./NewtownLayout.tsx.

import type { ReadbackSpec } from '../../components/SingleLineDiagram/readbackPositions';
import { defComponent, defWire } from '../../components/SingleLineDiagram/sldState';
import type { ProjectInfo } from '../types';

/** The layout's coordinate space. */
export const WIDTH = 1200;
export const HEIGHT = 800;

// The 4th argument is the set of "Related SLD Object" tokens (from the alarm
// spreadsheet) a component represents, so alarms route to the precise element
// rather than every component sharing a zone. Tokens with no element yet
// (`Net`, `M1`/`M2`, `SST-UPS`, `CE_SCADA`, `Estop`) fall back to zone matching.
// `Estop` stays that way on purpose: the E-stop indicator is drawn from
// `operationalMode`, not as a component, so it cannot pick up other
// BreakerRelay alarms through zone fallback.
export const COMPONENTS = [
  defComponent('site', 'Site'),
  defComponent('meter-main', 'Meter', undefined, ['Meter']),
  // SEL-451 protective relay. Kept under the BreakerRelay zone (it's the
  // relay that alarms publish against), but rendered as an off-line control
  // box with dashed supervision lines to the two 89L switches.
  defComponent('breaker-main', 'BreakerRelay', undefined, ['Relay']),
  defComponent('switch-89l-1', 'BreakerRelay', 'closed', ['52-MAIN-1']),
  defComponent('switch-89l-2', 'BreakerRelay', 'closed', ['52-MAIN-2']),
  defComponent('transformer-1', 'Transformer1', undefined, ['T1']),
  defComponent('transformer-2', 'Transformer2', undefined, ['T2']),
  defComponent('rtac', 'Rtac'),
  defComponent('fire-alarm-panel', 'Facp', undefined, ['FACP']),
  defComponent('tesla-site-controller', 'TeslaSiteController'),
  defComponent('megapack-1a', 'Mp1a', undefined, ['MP-1A']),
  defComponent('megapack-1b', 'Mp1b', undefined, ['MP-1B']),
  defComponent('megapack-1c', 'Mp1c', undefined, ['MP-1C']),
  defComponent('megapack-2a', 'Mp2a', undefined, ['MP-2A']),
  defComponent('megapack-2b', 'Mp2b', undefined, ['MP-2B']),
  defComponent('megapack-2c', 'Mp2c', undefined, ['MP-2C']),
  defComponent('feeder-1a', 'TeslaSiteController', 'closed'),
  defComponent('feeder-1b', 'TeslaSiteController', 'closed'),
  defComponent('feeder-1c', 'TeslaSiteController', 'closed'),
  defComponent('feeder-2a', 'TeslaSiteController', 'closed'),
  defComponent('feeder-2b', 'TeslaSiteController', 'closed'),
  defComponent('feeder-2c', 'TeslaSiteController', 'closed'),
  // Lockout relay — physical breaker-control handle driven by the SEL-451.
  // Shares the BreakerRelay zone for alarm mapping. 'closed' = CLOSE (normal),
  // 'open' = TRIP (breaker tripped / locked out).
  defComponent('lockout-relay', 'BreakerRelay', 'closed', ['LOR']),
];

export const WIRES = [
  defWire('wire-util-bus', 'site', 'bus-26kv'),
  defWire('wire-bus26-sw1', 'bus-26kv', 'switch-89l-1'),
  defWire('wire-bus26-sw2', 'bus-26kv', 'switch-89l-2'),
  defWire('wire-sw1-t1', 'switch-89l-1', 'transformer-1'),
  defWire('wire-sw2-t2', 'switch-89l-2', 'transformer-2'),
  defWire('wire-t1-bus480-1', 'transformer-1', 'bus-480-1'),
  defWire('wire-t2-bus480-2', 'transformer-2', 'bus-480-2'),
  defWire('wire-bus480-feeder-0', 'bus-480-1', 'feeder-1a'),
  defWire('wire-bus480-feeder-1', 'bus-480-1', 'feeder-1b'),
  defWire('wire-bus480-feeder-2', 'bus-480-1', 'feeder-1c'),
  defWire('wire-bus480-feeder-3', 'bus-480-2', 'feeder-2a'),
  defWire('wire-bus480-feeder-4', 'bus-480-2', 'feeder-2b'),
  defWire('wire-bus480-feeder-5', 'bus-480-2', 'feeder-2c'),
  defWire('wire-feeder-mega-0', 'feeder-1a', 'megapack-1a'),
  defWire('wire-feeder-mega-1', 'feeder-1b', 'megapack-1b'),
  defWire('wire-feeder-mega-2', 'feeder-1c', 'megapack-1c'),
  defWire('wire-feeder-mega-3', 'feeder-2a', 'megapack-2a'),
  defWire('wire-feeder-mega-4', 'feeder-2b', 'megapack-2b'),
  defWire('wire-feeder-mega-5', 'feeder-2c', 'megapack-2c'),
  // Control (dashed) wires — supervision/command paths, not power
  defWire('wire-sel-sw1', 'breaker-main', 'switch-89l-1'),
  defWire('wire-sel-sw2', 'breaker-main', 'switch-89l-2'),
  defWire('wire-sel-lockout', 'breaker-main', 'lockout-relay'),
  defWire('wire-facp', 'fire-alarm-panel', 'transformer-2'),
];

/**
 * One entry per interactable element, mirroring the Newtown design's
 * `SITE_CONTROLS` in neems-data.
 *
 * Note the two halves read in opposite directions, which is the site's
 * convention rather than ours: the line switches report *open* (101/102
 * `bps_89l_open`), the feeder breakers report *closed* (`ac_breaker_closed`).
 */
export const READBACKS: Record<string, ReadbackSpec> = {
  'switch-89l-1': { alarmNum: 101, whenActive: 'open' },
  'switch-89l-2': { alarmNum: 102, whenActive: 'open' },
  // 86-M1 set means the lockout relay has tripped, which the diagram draws as
  // the handle in its open position.
  'lockout-relay': { alarmNum: 103, whenActive: 'open' },
  'feeder-1a': { alarmNum: 607, whenActive: 'closed', irrationalAlarmNum: 615 },
  'feeder-1b': { alarmNum: 637, whenActive: 'closed', irrationalAlarmNum: 645 },
  'feeder-1c': { alarmNum: 667, whenActive: 'closed', irrationalAlarmNum: 675 },
  'feeder-2a': { alarmNum: 697, whenActive: 'closed', irrationalAlarmNum: 705 },
  'feeder-2b': { alarmNum: 727, whenActive: 'closed', irrationalAlarmNum: 735 },
  'feeder-2c': { alarmNum: 757, whenActive: 'closed', irrationalAlarmNum: 765 },
};

// Site identity is intentionally abstracted with placeholder values so the SLD
// can be shown/demoed without revealing the real site, address, or the
// utility/developer involved. Replace with real values only in a private build.
export const PROJECT_INFO: ProjectInfo = {
  name: 'Demo BESS 1A',
  address: '123 Example St, Anytown, NY 10001',
  codDate: 'June 2026',
  bessRating: '5 MW / 23.5 MWh',
  utilityProjectCode: '—',
  developerProjectNumber: '—',
};
