import type { ControlRequestView } from '../../utils/useSiteControls';
import type { EStopDisplayState, SldDiagramState, SwitchPosition } from './types';

/**
 * What every site design's diagram layout is given to draw.
 *
 * A layout owns where things go and how the site's equipment looks; the
 * diagram owns the state, the polling and the dialogs. This is the whole of
 * what passes between them, so a new site's layout plugs in by implementing it.
 */
export interface SldLayoutProps {
  state: SldDiagramState;
  /** Called when the Emergency Shutdown button is clicked. Owner displays the confirm dialog. */
  onEmergencyShutdownClicked: () => void;
  /** A shutdown request is recorded but its signal has not reached the site yet. */
  emergencyShutdownPending?: boolean;
  /** What the E-stop indicator draws; see [eStopDisplayState]. */
  eStopState: EStopDisplayState;
  /**
   * Ask a control to do something. A click is a *request to send a signal*, so
   * this is all a click does — the drawn position is not the diagram's to
   * change, and moves only when the site reports that it moved.
   */
  onControlRequested: (controlId: string, action: string) => void;
  /** What became of the last request against a control, for its badge. */
  controlRequestFor: (controlId: string) => ControlRequestView | null;
  /**
   * The action a click on this element should ask for, or `null` if the
   * backend does not offer one — in which case the element takes no click at
   * all rather than sending a request that will be refused. Also `null` before
   * the first poll returns, so nothing is clickable until we know what the
   * site accepts.
   */
  controlActionFor: (controlId: string, position: SwitchPosition | undefined) => string | null;
}
