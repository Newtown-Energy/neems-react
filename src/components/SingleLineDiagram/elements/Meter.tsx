import React from 'react';
import { useTheme } from '@mui/material';
import type { SldElementProps } from '../types';
import { useStatusColors } from './useStatusColors';
import AlarmIndicator from './AlarmIndicator';

/**
 * IEC metering point symbol: a circle with "M" inside.
 */
const Meter: React.FC<SldElementProps> = ({ x, y, state, label }) => {
  const theme = useTheme();
  const { stroke, strokeWidth } = useStatusColors(state);
  const lineColor = state.status === 'normal' ? theme.palette.text.primary : stroke;

  const r = 14;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Connection points top and bottom */}
      <circle cx={0} cy={-r} r={2} fill={lineColor} />
      <circle cx={0} cy={r} r={2} fill={lineColor} />
      {/* Meter circle */}
      <circle
        cx={0}
        cy={0}
        r={r}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
      />
      {/* "M" symbol */}
      <text
        x={0}
        y={5}
        textAnchor="middle"
        fontSize={14}
        fontFamily="monospace"
        fontWeight="bold"
        fill={lineColor}
      >
        M
      </text>
      {/* Label */}
      {label && (
        <text
          x={r + 6}
          y={4}
          fontSize={9}
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

export default Meter;
