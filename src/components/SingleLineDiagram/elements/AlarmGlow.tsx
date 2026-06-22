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
 *
 * The glow pulses only while at least one currently-active alarm is still
 * unacknowledged (`status === 'Active'`). Once every active alarm on the
 * component has been acknowledged (`AcknowledgedActive`), the glow renders
 * without its pulse animation so the operator isn't visually pestered — the
 * static color remains as a findable cue that the alarm is still present.
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
  // Pulse only while something is still firing AND unacknowledged. A
  // ReturnedUnacknowledged alarm is no longer firing, so it doesn't drive the
  // pulsing glow (the AlarmIndicator badge carries its distinct cue instead).
  const animate = state.activeAlarms.some((a) => a.status === 'Active');

  // No stroke on the glow — the parent entity already renders a severity-tinted
  // stroke via useStatusColors, so an outlined halo here would read as a
  // double border. Fill-only with a pulse keeps the background wash clearly
  // readable without competing with the entity outline.
  if (shape === 'circle' && radius != null) {
    return (
      <circle cx={0} cy={0} r={radius + padding} fill={color} opacity={animate ? 0.25 : 0.18}>
        {animate && (
          <animate
            attributeName="opacity"
            values="0.3;0.08;0.3"
            dur="1.5s"
            repeatCount="indefinite"
          />
        )}
      </circle>
    );
  }

  return (
    <rect
      x={-halfW - padding}
      y={-halfH - padding}
      width={halfW * 2 + padding * 2}
      height={halfH * 2 + padding * 2}
      fill={color}
      rx={4}
      opacity={animate ? 0.25 : 0.18}
    >
      {animate && (
        <animate
          attributeName="opacity"
          values="0.3;0.08;0.3"
          dur="1.5s"
          repeatCount="indefinite"
        />
      )}
    </rect>
  );
};

export default AlarmGlow;
