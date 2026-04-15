import React from 'react';
import { useTheme } from '@mui/material';
import type { SldElementProps } from '../types';
import { useStatusColors } from './useStatusColors';
import AlarmIndicator from './AlarmIndicator';

/**
 * Fire Alarm Control Panel (FACP) indicator.
 * Rendered as a rectangle with "FACP" text and a bell/alarm icon.
 */
const FireAlarmPanel: React.FC<SldElementProps> = ({ x, y, state, label = 'FACP' }) => {
  const theme = useTheme();
  const { stroke, fill, strokeWidth } = useStatusColors(state);
  const lineColor = state.status === 'normal' ? theme.palette.text.primary : stroke;
  const bgFill = state.status === 'normal' ? 'none' : fill;

  const w = 50;
  const h = 32;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Panel body */}
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
      {/* Bell icon (simplified) */}
      <path
        d={`M-6,-6 Q-6,-12 0,-12 Q6,-12 6,-6 L6,0 L-6,0 Z`}
        fill="none"
        stroke={lineColor}
        strokeWidth={1.5}
      />
      <line x1={-8} y1={0} x2={8} y2={0} stroke={lineColor} strokeWidth={1.5} />
      <circle cx={0} cy={3} r={1.5} fill={lineColor} />
      {/* Label below */}
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
      <AlarmIndicator state={state} offsetX={w / 2 + 4} offsetY={-h / 2 - 4} />
    </g>
  );
};

export default FireAlarmPanel;
