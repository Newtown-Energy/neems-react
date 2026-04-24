import React, { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import {
  ReactSVGPanZoom,
  TOOL_AUTO,
  INITIAL_VALUE,
  POSITION_RIGHT,
} from 'react-svg-pan-zoom';
import type { Tool, Value, ReactSVGPanZoomInstance } from 'react-svg-pan-zoom';
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

const DIAGRAM_WIDTH = 1200;
const DIAGRAM_HEIGHT = 800;

// --- Initial component definitions for Newtown site ---

const INITIAL_COMPONENTS = [
  defComponent('site', 'Site'),
  defComponent('meter-main', 'Meter'),
  // SEL-451 protective relay. Kept under the BreakerRelay zone (it's the
  // relay that alarms publish against), but rendered as an off-line control
  // box with dashed supervision lines to the two 89L switches.
  defComponent('breaker-main', 'BreakerRelay'),
  defComponent('switch-89l-1', 'BreakerRelay', 'closed'),
  defComponent('switch-89l-2', 'BreakerRelay', 'closed'),
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
  defComponent('feeder-1a', 'TeslaSiteController', 'closed'),
  defComponent('feeder-1b', 'TeslaSiteController', 'closed'),
  defComponent('feeder-1c', 'TeslaSiteController', 'closed'),
  defComponent('feeder-2a', 'TeslaSiteController', 'closed'),
  defComponent('feeder-2b', 'TeslaSiteController', 'closed'),
  defComponent('feeder-2c', 'TeslaSiteController', 'closed'),
  // Lockout relay — physical breaker-control handle driven by the SEL-451.
  // Shares the BreakerRelay zone for alarm mapping. 'closed' = CLOSE (normal),
  // 'open' = TRIP (breaker tripped / locked out).
  defComponent('lockout-relay', 'BreakerRelay', 'closed'),
];

const INITIAL_WIRES = [
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
  const [eStopDialogOpen, setEStopDialogOpen] = useState(false);

  // Pan/zoom viewer state. TOOL_AUTO gives click-through for buttons/switches
  // plus drag-to-pan and wheel/pinch zoom — the right default for a mixed
  // interactive diagram on desktop and tablet.
  const [tool, setTool] = useState<Tool>(TOOL_AUTO);
  const [viewerValue, setViewerValue] = useState<Value | Record<string, never>>(INITIAL_VALUE);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<ReactSVGPanZoomInstance | null>(null);
  const [viewerSize, setViewerSize] = useState({
    width: DIAGRAM_WIDTH,
    height: DIAGRAM_HEIGHT,
  });

  // Size the viewer to its container and fit the full diagram to whatever
  // size the viewer ends up at — so the whole site is visible on first paint
  // and after any resize, regardless of window width.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) {
        setViewerSize({ width: w, height: w * (DIAGRAM_HEIGHT / DIAGRAM_WIDTH) });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Whenever the viewer's pixel dimensions change, re-fit the diagram to it.
  useEffect(() => {
    // Defer so ReactSVGPanZoom has applied the new width/height internally.
    const id = requestAnimationFrame(() => {
      viewerRef.current?.fitToViewer();
    });
    return () => cancelAnimationFrame(id);
  }, [viewerSize.width, viewerSize.height]);

  useSldAlarms(dispatch, !demoMode);

  useEffect(() => {
    onDispatchReady?.(dispatch);
  }, [dispatch, onDispatchReady]);

  const stableOnStateChange = useCallback(
    (s: SldDiagramState) => onStateChange?.(s),
    [onStateChange],
  );
  useEffect(() => {
    stableOnStateChange(state);
  }, [state, stableOnStateChange]);

  const eStopActive = state.operationalMode === 'e-stop-active';

  const handleEStopConfirm = () => {
    dispatch({ type: 'SET_ESTOP_ACTIVE', active: !eStopActive });
    setEStopDialogOpen(false);
  };

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        maxWidth: DIAGRAM_WIDTH,
        aspectRatio: `${DIAGRAM_WIDTH} / ${DIAGRAM_HEIGHT}`,
        mx: 'auto',
        position: 'relative',
      }}
    >
      <ReactSVGPanZoom
        ref={viewerRef}
        width={viewerSize.width}
        height={viewerSize.height}
        tool={tool}
        onChangeTool={setTool}
        value={viewerValue}
        onChangeValue={setViewerValue}
        detectAutoPan={false}
        detectPinchGesture
        background="transparent"
        SVGBackground="transparent"
        scaleFactorMin={0.5}
        scaleFactorMax={6}
        toolbarProps={{ position: POSITION_RIGHT }}
      >
        <svg width={DIAGRAM_WIDTH} height={DIAGRAM_HEIGHT}>
          <NewtownLayout
            state={state}
            dispatch={dispatch}
            onEStopClicked={() => setEStopDialogOpen(true)}
          />
        </svg>
      </ReactSVGPanZoom>

      <Dialog open={eStopDialogOpen} onClose={() => setEStopDialogOpen(false)}>
        <DialogTitle>
          {eStopActive ? 'Remove E-Stop?' : 'Confirm E-Stop?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {eStopActive
              ? 'Removing E-Stop returns the site to normal operating mode. Line switches 89L-1 and 89L-2 will resume showing their commanded position. Confirm only after verifying it is safe to re-energize.'
              : 'Activating E-Stop will lock out line switches 89L-1 and 89L-2 and signal a site-wide emergency stop. This action should be used only in a genuine emergency.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEStopDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleEStopConfirm}
            color={eStopActive ? 'primary' : 'error'}
            variant="contained"
            autoFocus
          >
            {eStopActive ? 'Remove E-Stop' : 'Confirm E-Stop'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SingleLineDiagram;
