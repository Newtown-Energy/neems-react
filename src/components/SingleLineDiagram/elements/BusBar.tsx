import React from 'react';
import { useTheme } from '@mui/material';

interface BusBarProps {
  x: number;
  y: number;
  width: number;
  energized?: boolean;
  label?: string;
}

/**
 * A horizontal bus bar rendered as a thick line.
 */
const BusBar: React.FC<BusBarProps> = ({ x, y, width, energized = true, label }) => {
  const theme = useTheme();
  const color = energized
    ? theme.palette.text.primary
    : theme.palette.action.disabled;

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x={0}
        y={-3}
        width={width}
        height={6}
        fill={color}
        rx={1}
      />
      {label && (
        <text
          x={width / 2}
          y={-10}
          textAnchor="middle"
          fontSize={9}
          fontFamily="monospace"
          fill={theme.palette.text.secondary}
        >
          {label}
        </text>
      )}
    </g>
  );
};

export default BusBar;
