import React, { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
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
  diagramFrame,
  eStopDisplayState,
} from './sldState';
import type { SldAction } from './sldState';
import type { SldDiagramState } from './types';
import { useSldAlarms } from './useSldAlarms';
import { useSldAnalogs } from './useSldAnalogs';
import type { EmergencyShutdownRequestState } from '../../utils/useEmergencyShutdownRequest';
import { SldAlarmRefetchContext } from './SldAlarmRefetchContext';
import { useSiteDesign } from '../../designs/context';
import { useSiteContext } from '../../utils/SiteContext';
import { useDemoOverrides } from '../../utils/demoOverrides';
import { useSiteControls } from '../../utils/useSiteControls';
import CurtailmentBadge from './CurtailmentBadge';

interface SingleLineDiagramProps {
  /** Callback that receives the dispatch function so the parent can send actions. */
  onDispatchReady?: (dispatch: React.Dispatch<SldAction>) => void;
  /** Callback that receives the diagram state on each render so the parent can read it. */
  onStateChange?: (state: SldDiagramState) => void;
  /**
   * Emergency shutdown request state. Owned by the page so the page can render
   * request banners from the same polling instance the button reads.
   */
  emergencyShutdown: EmergencyShutdownRequestState;
}

/**
 * Top-level Single Line Diagram component.
 * Manages diagram state via useReducer and renders the session's site design's
 * layout inside an SVG.
 */
const SingleLineDiagram: React.FC<SingleLineDiagramProps> = ({
  onDispatchReady,
  onStateChange,
  emergencyShutdown,
}) => {
  const design = useSiteDesign();
  const { width: diagramWidth, height: diagramHeight, Layout } = design.diagram;
  const [state, dispatch] = useReducer(sldReducer, design, (d) =>
    createInitialState(d.diagram.components, d.diagram.wires),
  );
  const { overrides } = useDemoOverrides();
  const frame = diagramFrame(state, overrides.ignoreStaleData);
  const { selectedSite } = useSiteContext();
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);
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
        setViewerSize({ width: w, height: w * (diagramHeight / diagramWidth) });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [diagramWidth, diagramHeight]);

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

  // Gauge values, on the same cadence as the alarm poll. Separate from it
  // because the two answer different questions and a site with no analog
  // feed must still light its alarms.
  useSldAnalogs(dispatch, selectedSite?.id ?? null);

  // Operator requests against the switches, breakers and lockout relay. Kept
  // apart from the alarm and analog feeds because it answers a different
  // question: not what the site is doing, but what someone asked it to do and
  // whether that ask got out. It reads the drawn positions only to know when a
  // request's badge can go, and refetches the alarm feed those positions come
  // from once a request registers, so the badge and the equipment under it
  // change on the same render rather than a poll apart.
  const controls = useSiteControls(
    (controlId) => state.components[controlId]?.switchPosition,
    true,
    refetchAlarms,
  );

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

  // Whether the site is tripped comes from `state.operationalMode`, which the
  // alarm reducer derives from alarm 104 — what the RTAC reports, not anything
  // the browser decided. Confirming only *requests* a shutdown.
  const handleShutdownConfirm = async () => {
    setShutdownDialogOpen(false);
    await emergencyShutdown.trigger();
  };

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        maxWidth: '100%',
        aspectRatio: `${diagramWidth} / ${diagramHeight}`,
        mx: 'auto',
        position: 'relative',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      <CurtailmentBadge />
      {/* Main-pane border overlay: a flashing frame raised by stale site data
          (at Emergency) or by site-level faults (alarms targeting the
          spreadsheet's 'Border' SLD object, plus a fire emergency in the FACP
          zone). Its color tracks the severity, matching the alarm-badge
          palette. The frame is decorative (aria-hidden); the state is
          announced via the live region. See [diagramFrame] for the rules. */}
      {frame && (
        <>
          <Box
            aria-hidden
            data-testid={`sld-border-${frame.severity}`}
            sx={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 5,
              border: '4px solid',
              borderColor: severityColor(frame.severity, theme),
              borderRadius: 1,
              animation: 'sldBorderFlash 1.2s steps(1, end) infinite',
              '@keyframes sldBorderFlash': {
                '0%, 50%': { opacity: 1 },
                '50.01%, 100%': { opacity: 0.25 },
              },
            }}
          />
          <Box role="status" aria-live="assertive" sx={visuallyHidden}>
            {frame.announcement}
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
          <svg width={diagramWidth} height={diagramHeight}>
            <SldAlarmRefetchContext.Provider value={refetchAlarms}>
              <Layout
                state={state}
                onEmergencyShutdownClicked={() => setShutdownDialogOpen(true)}
                emergencyShutdownPending={emergencyShutdown.pending || emergencyShutdown.submitting}
                eStopState={eStopDisplayState(state, overrides.ignoreStaleData)}
                onControlRequested={(controlId, action) => {
                  void controls.request(controlId, action);
                }}
                controlRequestFor={controls.viewFor}
                controlActionFor={controls.actionFor}
              />
            </SldAlarmRefetchContext.Provider>
          </svg>
        </ReactSVGPanZoom>
      )}

      <Dialog open={shutdownDialogOpen} onClose={() => setShutdownDialogOpen(false)}>
        <DialogTitle>Request Emergency Shutdown?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This sends an emergency shutdown request to the site. The diagram
            will show the site as stopped only if the RTAC then reports a trip
            — what the site does with the request is decided on site, not here.
            This action should be used only in a genuine emergency.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2 }}>
            A tripped site cannot be cleared from here — it must be reset at
            the panel on site.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShutdownDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => { void handleShutdownConfirm(); }}
            color="error"
            variant="contained"
            autoFocus
          >
            Request Emergency Shutdown
          </Button>
        </DialogActions>
      </Dialog>

      {/* A request that never reached the site. The badge on the element says
          *that* it failed; this says *why*, in words, because a click that goes
          nowhere is otherwise indistinguishable from one the diagram ignored.
          Not auto-dismissed: an operator has to have actually seen it. */}
      <Snackbar
        open={controls.failure != null}
        // Only the explicit close button dismisses this. MUI's default fires
        // `onClose` with reason `clickaway` on any click anywhere on the page,
        // which silently retracts the one message telling an operator their
        // command never left the building.
        onClose={(_event, reason) => {
          if (reason !== 'clickaway') controls.dismissFailure();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="error"
          variant="filled"
          onClose={controls.dismissFailure}
          data-testid="control-request-failure"
        >
          {controls.failure
            ? `${controls.failure.label}: ${controls.failure.reason}`
            : ''}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SingleLineDiagram;
