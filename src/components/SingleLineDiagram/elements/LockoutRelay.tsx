import React from 'react';
import { useTheme } from '@mui/material';
import type { SldElementProps } from '../types';
import { useStatusColors } from './useStatusColors';
import AlarmIndicator from './AlarmIndicator';
import AlarmGlow from './AlarmGlow';
import { SLD_FONT } from '../sldTypography';

/**
 * Lockout relay — represents the physical breaker-control handle (TRIP / CLOSE)
 * that the SEL-451 drives via a dashed control line. Rendered as a small
 * rectangular face with a handle that rotates to reflect its position:
 *   switchPosition === 'closed' → CLOSE (normal operating position)
 *   switchPosition === 'open'   → TRIP  (breaker has been tripped / locked out)
 */
const LockoutRelay: React.FC<SldElementProps> = ({
  x,
  y,
  state,
  label = 'Lockout',
  onClick,
}) => {
  const theme = useTheme();
  const { stroke, strokeWidth } = useStatusColors(state);
  const isTripped = state.switchPosition === 'open';

  const lineColor = state.status === 'normal' ? theme.palette.text.primary : stroke;
  const faceColor = theme.palette.background.paper;

  const w = 48;
  const h = 40;

  // Handle pivots around the bottom-center of the face.
  // TRIP = handle rotated down-left, CLOSE = handle down-right.
  const handleAngle = isTripped ? -35 : 35;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Pulsing severity glow — behind the face plate for Emergency/Critical */}
      <AlarmGlow state={state} halfW={w / 2} halfH={h / 2} />
      {/* Face plate */}
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        fill={faceColor}
        stroke={lineColor}
        strokeWidth={strokeWidth}
        rx={2}
      />
      {/* Red trip-indicator window at top center */}
      <rect
        x={-4}
        y={-h / 2 + 4}
        width={8}
        height={5}
        fill={isTripped ? theme.palette.error.main : theme.palette.action.disabled}
        stroke={lineColor}
        strokeWidth={0.5}
        rx={1}
      />
      {/* TRIP / CLOSE labels flanking the handle */}
      <text
        x={-w / 2 + 4}
        y={2}
        fontSize={8}
        fontFamily="monospace"
        fontWeight="bold"
        fill={lineColor}
      >
        TRIP
      </text>
      <text
        x={w / 2 - 4}
        y={2}
        textAnchor="end"
        fontSize={8}
        fontFamily="monospace"
        fontWeight="bold"
        fill={lineColor}
      >
        CLOSE
      </text>
      {/* Handle — rotates around the pivot at the bottom-center of the face */}
      <g transform={`translate(0, ${h / 2 - 4}) rotate(${handleAngle})`}>
        <circle cx={0} cy={0} r={2.5} fill={lineColor} />
        <rect
          x={-2}
          y={-14}
          width={4}
          height={14}
          fill={lineColor}
          rx={1}
        />
      </g>
      {/* Label below */}
      {label && (
        <text
          x={0}
          y={h / 2 + 14}
          textAnchor="middle"
          fontSize={SLD_FONT.label}
          fontFamily="monospace"
          fontWeight="bold"
          fill={theme.palette.text.primary}
        >
          {label}
        </text>
      )}
      <AlarmIndicator state={state} offsetX={w / 2 + 4} offsetY={-h / 2 - 4} />
    </g>
  );
};

export default LockoutRelay;
