import React from 'react';
import { useTheme } from '@mui/material';
import type { SldElementProps } from '../types';
import { useStatusColors } from './useStatusColors';
import AlarmIndicator from './AlarmIndicator';

/**
 * Utility line-in connection: a downward-pointing triangle meeting the power
 * line, with a labeled box (the utility line/circuit number) to the right.
 */
const UtilityConnection: React.FC<SldElementProps> = ({
  x,
  y,
  state,
  label = 'UTILITY',
}) => {
  const theme = useTheme();
  const { stroke } = useStatusColors(state);
  const lineColor = state.status === 'normal' ? theme.palette.text.primary : stroke;

  const w = 18;
  const h = 20;
  const boxW = 100;
  const boxH = 32;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Downward-pointing triangle */}
      <polygon
        points={`${-w / 2},${-h} ${w / 2},${-h} 0,0`}
        fill={lineColor}
        stroke={lineColor}
        strokeWidth={1}
      />
      {/* Connection point where triangle meets the line */}
      <circle cx={0} cy={0} r={2} fill={lineColor} />

      {/* Line-number label box to the right */}
      <rect
        x={w}
        y={-h - 6}
        width={boxW}
        height={boxH}
        fill={theme.palette.background.paper}
        stroke={theme.palette.text.primary}
        strokeWidth={1}
        rx={2}
      />
      <text
        x={w + boxW / 2}
        y={-h + 14}
        textAnchor="middle"
        fontSize={13}
        fontFamily="monospace"
        fontWeight="bold"
        fill={theme.palette.text.primary}
      >
        {label}
      </text>

      <AlarmIndicator state={state} offsetX={w / 2 + 4} offsetY={-h - 10} />
    </g>
  );
};

export default UtilityConnection;
