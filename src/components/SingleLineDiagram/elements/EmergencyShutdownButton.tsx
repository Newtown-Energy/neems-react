import React from 'react';
import { useTheme } from '@mui/material';
import { SLD_FONT } from '../sldTypography';

interface EmergencyShutdownButtonProps {
  x: number;
  y: number;
  /** The RTAC reports the site's E-stop tripped (alarm 104). Read, never authored. */
  eStopActive: boolean;
  /** A request is recorded but its signal has not reached the site yet. */
  pending?: boolean;
  onClick: () => void;
}

/**
 * Large round Emergency Shutdown button rendered directly into the SVG.
 *
 * It sends an emergency shutdown request: it *asks* the site to shut down, and
 * never reports that it has. The site's E-stop is a physical button this
 * cannot press; what the site reports about it is drawn separately by
 * [EStopIndicator]. Three presentations:
 *
 * - idle: red circle, "EMERGENCY SHUTDOWN", clickable.
 * - pending: red circle, "SENDING", not clickable — the signal is on its way.
 * - E-stop active: outlined and dimmed, not clickable. The site is already
 *   tripped, and software does not clear a latched E-stop; that happens at the
 *   panel, after which alarm 104 drops and this returns to idle on its own.
 *   The reason is on screen, not only in the tooltip: the E-stop indicator
 *   drawn directly beneath this reads TRIPPED.
 *
 * Note that a signal already delivered returns the button to idle rather than
 * disabling it. Whether the site acted on it is not something this system can
 * observe, so refusing to let an operator re-send is not this component's call
 * to make.
 *
 * The caller owns confirmation dialogs; this component only reports clicks.
 */
const EmergencyShutdownButton: React.FC<EmergencyShutdownButtonProps> = ({
  x,
  y,
  eStopActive,
  pending = false,
  onClick,
}) => {
  const theme = useTheme();
  const red = theme.palette.error.main;

  const r = 50;
  const actionable = !eStopActive && !pending;
  const fill = eStopActive ? theme.palette.background.paper : red;
  const textColor = eStopActive ? red : '#ffffff';

  const lines = pending ? ['SENDING'] : ['EMERGENCY', 'SHUTDOWN'];

  const title = eStopActive
    ? 'The site E-stop is tripped — clear it at the panel on site'
    : pending
      ? 'Sending the emergency shutdown request to the site'
      : 'Request an emergency shutdown of the site';

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={actionable ? onClick : undefined}
      style={{ cursor: actionable ? 'pointer' : 'default' }}
      role={actionable ? 'button' : 'img'}
      aria-label={title}
      aria-disabled={actionable ? undefined : true}
      data-testid="sld-emergency-shutdown-button"
      data-shutdown-state={eStopActive ? 'estop-active' : pending ? 'pending' : 'idle'}
      // Dimmed so it reads as unavailable at a glance, not as a control that
      // silently ignores clicks.
      opacity={eStopActive ? 0.45 : 1}
    >
      <title>{title}</title>
      {/* Outer bezel */}
      <circle cx={0} cy={0} r={r + 3} fill={red} opacity={eStopActive ? 0.25 : 0.4} />
      {/* Button body. A pending request pulses so the wait reads as activity
          rather than an unresponsive control. */}
      <circle
        cx={0}
        cy={0}
        r={r}
        fill={fill}
        stroke={red}
        strokeWidth={3}
        opacity={pending ? 0.75 : 1}
      >
        {pending && (
          <animate
            attributeName="opacity"
            values="0.75;1;0.75"
            dur="1.2s"
            repeatCount="indefinite"
          />
        )}
      </circle>
      {lines.map((line, i) => (
        <text
          key={line}
          x={0}
          // One line sits on the centre; two straddle it.
          y={lines.length === 1 ? 5 : i === 0 ? -3 : 13}
          textAnchor="middle"
          fontSize={pending ? SLD_FONT.subtitle : SLD_FONT.badge}
          fontFamily="sans-serif"
          fontWeight="bold"
          fill={textColor}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {line}
        </text>
      ))}
    </g>
  );
};

export default EmergencyShutdownButton;
