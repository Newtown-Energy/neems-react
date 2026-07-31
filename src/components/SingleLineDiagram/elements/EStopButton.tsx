import React from 'react';
import { useTheme } from '@mui/material';

interface EStopButtonProps {
  x: number;
  y: number;
  /** The RTAC reports the site tripped (alarm 104). Read, never authored. */
  active: boolean;
  /** A request has been recorded but the RTAC has not confirmed it yet. */
  pending?: boolean;
  onClick: () => void;
}

/**
 * Large round E-stop button rendered directly into the SVG.
 *
 * Engage-only. The button *asks* for a trip; it never reports one. Three
 * presentations:
 *
 * - idle (`!active`): red circle, "E-STOP", clickable.
 * - pending: red circle, "REQUESTING", not clickable — the ask is in flight.
 * - active: outlined, "E-STOP ACTIVE", not clickable. Software does not clear
 *   a latched E-stop; that happens at the panel, after which alarm 104 drops
 *   and this returns to idle on its own.
 *
 * The caller owns confirmation dialogs; this component only reports clicks.
 */
const EStopButton: React.FC<EStopButtonProps> = ({ x, y, active, pending = false, onClick }) => {
  const theme = useTheme();
  const red = theme.palette.error.main;

  const r = 44;
  const actionable = !active && !pending;
  const fill = active ? theme.palette.background.paper : red;
  const textColor = active ? red : '#ffffff';

  const label = active ? 'E-STOP' : pending ? 'REQUESTING' : 'E-STOP';
  const subLabel = active ? 'ACTIVE' : null;

  const title = active
    ? 'E-stop is active — clear it at the panel'
    : pending
      ? 'E-stop requested, waiting for the site to confirm'
      : 'Request a site-wide emergency stop';

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={actionable ? onClick : undefined}
      style={{ cursor: actionable ? 'pointer' : 'default' }}
      role={actionable ? 'button' : 'img'}
      aria-label={title}
      aria-disabled={actionable ? undefined : true}
      data-testid="sld-estop-button"
      data-estop-state={active ? 'active' : pending ? 'pending' : 'idle'}
    >
      <title>{title}</title>
      {/* Outer bezel */}
      <circle cx={0} cy={0} r={r + 3} fill={red} opacity={active ? 0.25 : 0.4} />
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
      {/* Primary label */}
      <text
        x={0}
        y={subLabel ? -2 : 6}
        textAnchor="middle"
        fontSize={pending ? 12 : subLabel ? 13 : 16}
        fontFamily="sans-serif"
        fontWeight="bold"
        fill={textColor}
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {label}
      </text>
      {subLabel && (
        <text
          x={0}
          y={14}
          textAnchor="middle"
          fontSize={13}
          fontFamily="sans-serif"
          fontWeight="bold"
          fill={textColor}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {subLabel}
        </text>
      )}
    </g>
  );
};

export default EStopButton;
