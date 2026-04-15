import React from 'react';
import { useTheme } from '@mui/material';
import type { SldElementProps } from '../types';
import { useStatusColors } from './useStatusColors';
import AlarmIndicator from './AlarmIndicator';

/**
 * IEC transformer symbol: two overlapping circles.
 * The circles represent the primary and secondary windings.
 */
const Transformer: React.FC<SldElementProps> = ({ x, y, state, label }) => {
  const theme = useTheme();
  const { stroke, strokeWidth } = useStatusColors(state);
  const lineColor = state.status === 'normal' ? theme.palette.text.primary : stroke;

  const r = 14;
  const offset = 10; // vertical offset between circles

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Primary winding (top circle) */}
      <circle
        cx={0}
        cy={-offset}
        r={r}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
      />
      {/* Secondary winding (bottom circle) */}
      <circle
        cx={0}
        cy={offset}
        r={r}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
      />
      {/* Connection dots top and bottom */}
      <circle cx={0} cy={-offset - r} r={2} fill={lineColor} />
      <circle cx={0} cy={offset + r} r={2} fill={lineColor} />
      {/* Label */}
      {label && (
        <text
          x={r + 6}
          y={4}
          fontSize={10}
          fontFamily="monospace"
          fill={theme.palette.text.primary}
        >
          {label}
        </text>
      )}
      <AlarmIndicator state={state} offsetX={r + 4} offsetY={-r - 4} />
    </g>
  );
};

export default Transformer;
