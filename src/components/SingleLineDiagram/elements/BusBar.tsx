import React from 'react';
import { useTheme } from '@mui/material';
import { SLD_FONT } from '../sldTypography';

interface BusBarProps {
  x: number;
  y: number;
  width: number;
  energized?: boolean;
  label?: string;
  /**
   * Absolute X-coordinates (in the same coord space as `x`) where junction
   * nodes should be rendered. Each node is drawn as a filled blue dot on top
   * of the bus — they represent the "electrically connected" node symbol.
   */
  nodes?: number[];
}

/**
 * Horizontal bus bar rendered as a thick line. When `nodes` are provided,
 * filled blue dots are placed at each junction to show electrical continuity.
 */
const BusBar: React.FC<BusBarProps> = ({
  x,
  y,
  width,
  energized = true,
  label,
  nodes,
}) => {
  const theme = useTheme();
  const color = energized
    ? theme.palette.text.primary
    : theme.palette.action.disabled;
  const nodeColor = theme.palette.info.main;

  return (
    <>
      <g transform={`translate(${x}, ${y})`}>
        <rect x={0} y={-3} width={width} height={6} fill={color} rx={1} />
        {label && (
          <text
            x={8}
            y={-8}
            textAnchor="start"
            fontSize={SLD_FONT.bus}
            fontFamily="monospace"
            fontWeight="bold"
            fill={theme.palette.text.secondary}
          >
            {label}
          </text>
        )}
      </g>
      {/* Node dots in absolute coords (nodes array is in the caller's space) */}
      {nodes?.map((nx) => (
        <circle
          key={`bus-node-${nx}`}
          cx={nx}
          cy={y}
          r={4}
          fill={nodeColor}
          stroke={nodeColor}
          strokeWidth={1}
        />
      ))}
    </>
  );
};

export default BusBar;
