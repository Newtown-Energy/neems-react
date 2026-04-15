import React from 'react';
import { useTheme } from '@mui/material';
import type { SldElementProps } from '../types';
import { useStatusColors } from './useStatusColors';
import AlarmIndicator from './AlarmIndicator';

/**
 * Battery / Megapack symbol: a rectangle with battery cell lines inside.
 * Standard IEC battery notation with + and - terminals.
 */
const Megapack: React.FC<SldElementProps> = ({ x, y, state, label }) => {
  const theme = useTheme();
  const { stroke, fill, strokeWidth } = useStatusColors(state);
  const lineColor = state.status === 'normal' ? theme.palette.text.primary : stroke;
  const bgFill = state.status === 'normal' ? 'none' : fill;

  const w = 36;
  const h = 48;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Connection point top */}
      <circle cx={0} cy={-h / 2} r={2} fill={lineColor} />
      {/* Battery body */}
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        fill={bgFill}
        stroke={lineColor}
        strokeWidth={strokeWidth}
        rx={2}
      />
      {/* Battery cell divider lines */}
      <line x1={-w / 2} y1={-h / 6} x2={w / 2} y2={-h / 6} stroke={lineColor} strokeWidth={1} opacity={0.5} />
      <line x1={-w / 2} y1={h / 6} x2={w / 2} y2={h / 6} stroke={lineColor} strokeWidth={1} opacity={0.5} />
      {/* + terminal indicator */}
      <text
        x={0}
        y={-h / 2 + 14}
        textAnchor="middle"
        fontSize={12}
        fontFamily="monospace"
        fontWeight="bold"
        fill={lineColor}
      >
        +
      </text>
      {/* - terminal indicator */}
      <text
        x={0}
        y={h / 2 - 6}
        textAnchor="middle"
        fontSize={12}
        fontFamily="monospace"
        fontWeight="bold"
        fill={lineColor}
      >
        -
      </text>
      {/* Label below */}
      {label && (
        <text
          x={0}
          y={h / 2 + 14}
          textAnchor="middle"
          fontSize={10}
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

export default Megapack;
