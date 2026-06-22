import React, { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  useTheme,
} from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import { severityColor } from './elements/useStatusColors';
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
import { SldAlarmRefetchContext } from './SldAlarmRefetchContext';
import NewtownLayout from './layouts/NewtownLayout';
import CurtailmentBadge from './CurtailmentBadge';

const DIAGRAM_WIDTH = 1200;
const DIAGRAM_HEIGHT = 800;

// --- Initial component definitions for Newtown site ---

// The 4th argument is the set of "Related SLD Object" tokens (from the alarm
// spreadsheet) a component represents, so alarms route to the precise element
// rather than every component sharing a zone. Tokens with no element yet
// (`Net`, `M1`/`M2`, `SST-UPS`, `CE_SCADA`, `Estop`) fall back to zone matching.
const INITIAL_COMPONENTS = [
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
  onDispatchReady,
  onStateChange,
}) => {
  const [state, dispatch] = useReducer(sldReducer, INITIAL_STATE);
  const [eStopDialogOpen, setEStopDialogOpen] = useState(false);
  const theme = useTheme();

  // Pan/zoom viewer state. TOOL_AUTO gives click-through for buttons/switches
  // plus drag-to-pan and wheel/pinch zoom — the right default for a mixed
  // interactive diagram on desktop and tablet.
  const [tool, setTool] = useState<Tool>(TOOL_AUTO);
  const [viewerValue, setViewerValue] = useState<Value | Record<string, never>>(INITIAL_VALUE);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<ReactSVGPanZoomInstance | null>(null);
  // null until the container has been measured, so we never render the viewer
  // at a hardcoded initial size that might exceed the window.
  const [viewerSize, setViewerSize] = useState<{ width: number; height: number } | null>(null);

  // Size the viewer to its container and re-fit the diagram whenever the
  // container resizes — covers shrinking as well as expanding.
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
    if (!viewerSize) return;
    // Defer so ReactSVGPanZoom has applied the new width/height internally.
    const id = requestAnimationFrame(() => {
      viewerRef.current?.fitToViewer();
    });
    return () => cancelAnimationFrame(id);
  }, [viewerSize]);

  // Always poll active alarms. The /Alarms/Active response now respects
  // demo overrides server-side (forced alarms come through), and the
  // alarm reducer never touches breaker/switch positions — so leaving
  // polling on in demoMode is safe and lets forced alarms surface
  // through the same path real alarms use.
  const { refetch: refetchAlarms } = useSldAlarms(dispatch);

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
        maxWidth: '100%',
        aspectRatio: `${DIAGRAM_WIDTH} / ${DIAGRAM_HEIGHT}`,
        mx: 'auto',
        position: 'relative',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      <CurtailmentBadge />
      {/* Main-pane border overlay: a flashing frame raised by site-level faults
          (alarms targeting the spreadsheet's 'Border' SLD object, plus a fire
          emergency in the FACP zone). Its color tracks the highest severity
          among those alarms, matching the alarm-badge palette. The frame is
          decorative (aria-hidden); the state is announced via the live region. */}
      {state.border && (
        <>
          <Box
            aria-hidden
            data-testid={`sld-border-${state.border.severity}`}
            sx={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 5,
              border: '4px solid',
              borderColor: severityColor(state.border.severity, theme),
              borderRadius: 1,
              animation: 'sldBorderFlash 1.2s steps(1, end) infinite',
              '@keyframes sldBorderFlash': {
                '0%, 50%': { opacity: 1 },
                '50.01%, 100%': { opacity: 0.25 },
              },
            }}
          />
          <Box role="status" aria-live="assertive" sx={visuallyHidden}>
            {`Site-level ${state.border.severity.toLowerCase()} alarm active`}
          </Box>
        </>
      )}
      {viewerSize && (
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
          disableDoubleClickZoomWithToolAuto
          background="transparent"
          SVGBackground="transparent"
          scaleFactorMin={0.5}
          scaleFactorMax={6}
          toolbarProps={{ position: POSITION_RIGHT }}
        >
          <svg width={DIAGRAM_WIDTH} height={DIAGRAM_HEIGHT}>
            <SldAlarmRefetchContext.Provider value={refetchAlarms}>
              <NewtownLayout
                state={state}
                dispatch={dispatch}
                onEStopClicked={() => setEStopDialogOpen(true)}
              />
            </SldAlarmRefetchContext.Provider>
          </svg>
        </ReactSVGPanZoom>
      )}

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
