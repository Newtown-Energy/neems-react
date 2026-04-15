import React, { useReducer, useCallback } from 'react';
import { Box } from '@mui/material';
import {
  sldReducer,
  createInitialState,
  defComponent,
  defWire,
} from './sldState';
import type { SldAction } from './sldState';
import type { SldDiagramState } from './types';
import { useSldAlarms } from './useSldAlarms';
import NewtownLayout from './layouts/NewtownLayout';

// --- Initial component definitions for Newtown site ---

const INITIAL_COMPONENTS = [
  defComponent('site', 'Site'),
  defComponent('meter-main', 'Meter'),
  defComponent('breaker-main', 'BreakerRelay', 'closed'),
  defComponent('transformer-1', 'Transformer1'),
  defComponent('transformer-2', 'Transformer2'),
  defComponent('rtac', 'Rtac'),
  defComponent('fire-alarm-panel', 'Facp'),
  defComponent('tesla-site-controller', 'TeslaSiteController'),
  defComponent('megapack-1a', 'Mp1a'),
  defComponent('megapack-1b', 'Mp1b'),
  defComponent('megapack-1c', 'Mp1c'),
  defComponent('megapack-2a', 'Mp2a'),
  defComponent('megapack-2b', 'Mp2b'),
  defComponent('megapack-2c', 'Mp2c'),
  // Feeder breakers (use TeslaSiteController zone as a group for now)
  defComponent('feeder-1a', 'TeslaSiteController', 'closed'),
  defComponent('feeder-1b', 'TeslaSiteController', 'closed'),
  defComponent('feeder-1c', 'TeslaSiteController', 'closed'),
  defComponent('feeder-2a', 'TeslaSiteController', 'closed'),
  defComponent('feeder-2b', 'TeslaSiteController', 'closed'),
  defComponent('feeder-2c', 'TeslaSiteController', 'closed'),
];

const INITIAL_WIRES = [
  defWire('wire-util-meter', 'site', 'meter-main'),
  defWire('wire-meter-brk', 'meter-main', 'breaker-main'),
  defWire('wire-brk-t1', 'breaker-main', 'transformer-1'),
  defWire('wire-brk-t2', 'breaker-main', 'transformer-2'),
  defWire('wire-t1-bus', 'transformer-1', 'bus'),
  defWire('wire-t2-bus', 'transformer-2', 'bus'),
  defWire('wire-bus-feeder-0', 'bus', 'feeder-1a'),
  defWire('wire-bus-feeder-1', 'bus', 'feeder-1b'),
  defWire('wire-bus-feeder-2', 'bus', 'feeder-1c'),
  defWire('wire-bus-feeder-3', 'bus', 'feeder-2a'),
  defWire('wire-bus-feeder-4', 'bus', 'feeder-2b'),
  defWire('wire-bus-feeder-5', 'bus', 'feeder-2c'),
  defWire('wire-feeder-mega-0', 'feeder-1a', 'megapack-1a'),
  defWire('wire-feeder-mega-1', 'feeder-1b', 'megapack-1b'),
  defWire('wire-feeder-mega-2', 'feeder-1c', 'megapack-1c'),
  defWire('wire-feeder-mega-3', 'feeder-2a', 'megapack-2a'),
  defWire('wire-feeder-mega-4', 'feeder-2b', 'megapack-2b'),
  defWire('wire-feeder-mega-5', 'feeder-2c', 'megapack-2c'),
];

const INITIAL_STATE = createInitialState(INITIAL_COMPONENTS, INITIAL_WIRES);

interface SingleLineDiagramProps {
  /** When true, live alarm polling is paused (for demo mode). */
  demoMode?: boolean;
  /** Callback that receives the dispatch function so the parent can send actions. */
  onDispatchReady?: (dispatch: React.Dispatch<SldAction>) => void;
  /** Callback that receives the diagram state on each render so the parent can read it. */
  onStateChange?: (state: SldDiagramState) => void;
}

/**
 * Top-level Single Line Diagram component.
 * Manages diagram state via useReducer and renders the site layout inside an SVG.
 */
const SingleLineDiagram: React.FC<SingleLineDiagramProps> = ({
  demoMode = false,
  onDispatchReady,
  onStateChange,
}) => {
  const [state, dispatch] = useReducer(sldReducer, INITIAL_STATE);

  // Poll alarms and map to diagram state (paused in demo mode)
  useSldAlarms(dispatch, !demoMode);

  // Expose dispatch to parent
  React.useEffect(() => {
    onDispatchReady?.(dispatch);
  }, [dispatch, onDispatchReady]);

  // Notify parent of state changes
  const stableOnStateChange = useCallback(
    (s: SldDiagramState) => onStateChange?.(s),
    [onStateChange],
  );
  React.useEffect(() => {
    stableOnStateChange(state);
  }, [state, stableOnStateChange]);

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 1200,
        aspectRatio: '3 / 2',
        mx: 'auto',
      }}
    >
      <svg
        viewBox="0 0 1200 800"
        width="100%"
        height="100%"
        style={{ display: 'block' }}
      >
        {/* Background */}
        <rect width="1200" height="800" fill="none" />
        <NewtownLayout state={state} dispatch={dispatch} />
      </svg>
    </Box>
  );
};

export default SingleLineDiagram;
