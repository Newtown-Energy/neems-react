import React from 'react';
import { useTheme } from '@mui/material';
import type { SldElementProps } from '../types';
import { useStatusColors } from './useStatusColors';
import AlarmIndicator from './AlarmIndicator';

/**
 * IEC utility/grid connection symbol: three angled lines representing
 * an infinite bus / power source.
 */
const UtilityConnection: React.FC<SldElementProps> = ({ x, y, state, label = 'UTILITY' }) => {
  const theme = useTheme();
  const { stroke } = useStatusColors(state);
  const lineColor = state.status === 'normal' ? theme.palette.text.primary : stroke;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Three angled lines (grid symbol) */}
      <line x1={-12} y1={-18} x2={0} y2={0} stroke={lineColor} strokeWidth={2} />
      <line x1={0} y1={-18} x2={0} y2={0} stroke={lineColor} strokeWidth={2} />
      <line x1={12} y1={-18} x2={0} y2={0} stroke={lineColor} strokeWidth={2} />
      {/* Connection point */}
      <circle cx={0} cy={0} r={3} fill={lineColor} />
      {/* Label */}
      <text
        x={0}
        y={-24}
        textAnchor="middle"
        fontSize={11}
        fontFamily="monospace"
        fill={theme.palette.text.primary}
      >
        {label}
      </text>
      <AlarmIndicator state={state} offsetX={16} offsetY={-16} />
    </g>
  );
};

export default UtilityConnection;
