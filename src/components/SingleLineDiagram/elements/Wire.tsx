import React from 'react';
import { useTheme } from '@mui/material';
import type { SldWireProps } from '../types';

interface WireProps extends SldWireProps {
  /**
   * When true, renders as a dashed grey "control" line (used for SEL-451 →
   * switch connections and the FACP supervision line). `state.energized` is
   * ignored for control lines.
   */
  control?: boolean;
}

/**
 * A wire/connection line between two points.
 * Straight lines or polylines via waypoints. Appearance is driven by either
 * `energized` state (power path) or the `control` flag (dashed grey overlay).
 */
const Wire: React.FC<WireProps> = ({
  x1,
  y1,
  x2,
  y2,
  state,
  waypoints,
  control = false,
}) => {
  const theme = useTheme();

  const color = control
    ? theme.palette.text.secondary
    : state.energized
      ? theme.palette.text.primary
      : theme.palette.action.disabled;
  const width = control ? 1 : state.energized ? 2 : 1;
  const dashArray = control ? '5 3' : state.energized ? undefined : '4 4';

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
