import React from 'react';
import { useTheme } from '@mui/material';
import type { SldComponentState } from '../types';
import { severityColor } from './useStatusColors';
import { useAllAlarmsAcknowledged } from '../../../utils/alarmAcknowledge';

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
 * When *all* of the component's active alarms have been acknowledged via
 * [acknowledgeAlarm], the glow renders without its pulse animation so
 * the operator isn't visually pestered — the static color remains as a
 * findable cue that the alarm is still present.
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
  const allAcked = useAllAlarmsAcknowledged(
    state.activeAlarms.map(a => a.alarm_num)
  );

  if (!state.highestSeverity) return null;
  const shouldPulse =
    state.highestSeverity === 'Emergency' || state.highestSeverity === 'Critical';
  if (!shouldPulse) return null;

  const color = severityColor(state.highestSeverity, theme);
  const animate = !allAcked;

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
