import React from 'react';
import { useTheme } from '@mui/material';
import type { SldWireProps } from '../types';

/**
 * A wire/connection line between two points.
 * Supports straight lines and polylines via waypoints.
 * Visual style changes based on energized state.
 */
const Wire: React.FC<SldWireProps> = ({ x1, y1, x2, y2, state, waypoints }) => {
  const theme = useTheme();

  const color = state.energized
    ? theme.palette.text.primary
    : theme.palette.action.disabled;
  const width = state.energized ? 2 : 1;
  const dashArray = state.energized ? undefined : '4 4';

  if (waypoints && waypoints.length > 0) {
    const points = [
      `${x1},${y1}`,
      ...waypoints.map((wp) => `${wp.x},${wp.y}`),
      `${x2},${y2}`,
    ].join(' ');

    return (
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dashArray}
      />
    );
  }

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={width}
      strokeDasharray={dashArray}
    />
  );
};

export default Wire;
