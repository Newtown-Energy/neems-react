import React from 'react';
import { useTheme } from '@mui/material';
import type { SldComponentState } from '../types';
import { severityColor } from './useStatusColors';

interface AlarmGlowProps {
  state: SldComponentState;
  /** Inner half-width of the wrapped entity. Ignored when `shape` is 'circle'. */
  halfW?: number;
  /** Inner half-height of the wrapped entity. Ignored when `shape` is 'circle'. */
  halfH?: number;
  /** Inner radius for circular entities (e.g. Meter). */
  radius?: number;
  /** Shape of the glow outline. */
  shape?: 'rect' | 'circle';
  /** Extra padding added outside the entity bounds. */
  padding?: number;
}

/**
 * Pulsing colored border rendered behind a parent entity when the entity
 * carries an Emergency or Critical active alarm. Sits in the component's
 * local coordinate space (assumes the parent has already translated to the
 * entity's center) so callers only need to provide the entity's half-size.
 */
const AlarmGlow: React.FC<AlarmGlowProps> = ({
  state,
  halfW = 0,
  halfH = 0,
  radius,
  shape = 'rect',
  padding = 5,
}) => {
  const theme = useTheme();

  if (!state.highestSeverity) return null;
  const shouldPulse =
    state.highestSeverity === 'Emergency' || state.highestSeverity === 'Critical';
  if (!shouldPulse) return null;

  const color = severityColor(state.highestSeverity, theme);

  if (shape === 'circle' && radius != null) {
    return (
      <circle
        cx={0}
        cy={0}
        r={radius + padding}
        fill={`${color}15`}
        stroke={color}
        strokeWidth={3}
        opacity={0.85}
      >
        <animate
          attributeName="opacity"
          values="0.85;0.3;0.85"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </circle>
    );
  }

  return (
    <rect
      x={-halfW - padding}
      y={-halfH - padding}
      width={halfW * 2 + padding * 2}
      height={halfH * 2 + padding * 2}
      fill={`${color}15`}
      stroke={color}
      strokeWidth={3}
      rx={4}
      opacity={0.85}
    >
      <animate
        attributeName="opacity"
        values="0.85;0.3;0.85"
        dur="1.5s"
        repeatCount="indefinite"
      />
    </rect>
  );
};

export default AlarmGlow;
