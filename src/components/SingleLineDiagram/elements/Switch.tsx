import React from 'react';
import { useTheme } from '@mui/material';
import type { SldComponentState, SwitchVisualState } from '../types';
import AlarmIndicator from './AlarmIndicator';
import AlarmGlow from './AlarmGlow';
import { SLD_FONT } from '../sldTypography';

interface SwitchProps {
  x: number;
  y: number;
  state: SldComponentState;
  visualState: SwitchVisualState;
  label?: string;
  onClick?: () => void;
}

/**
 * Knife-switch symbol for 89L-style line switches.
 *
 * Colors:
 *   closed → red outline, horizontal straight contact
 *   open → green outline, arm angled up-right
 *   locked-out → grey outline, arm angled up-right (same shape as open)
 */
const Switch: React.FC<SwitchProps> = ({
  x,
  y,
  state,
  visualState,
  label,
  onClick,
}) => {
  const theme = useTheme();

  const colorFor = (v: SwitchVisualState) => {
    switch (v) {
      case 'closed':
        return theme.palette.error.main;
      case 'open':
        return theme.palette.success.main;
      case 'locked-out':
        return theme.palette.action.disabled;
    }
  };

  const color = colorFor(visualState);
  const isClosed = visualState === 'closed';

  const halfH = 18; // vertical half of the box
  const halfW = 12;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Pulsing severity glow — behind the switch body for Emergency/Critical */}
      <AlarmGlow state={state} halfW={halfW} halfH={halfH} />
      {/* Top connection point (bus side) */}
      <circle cx={0} cy={-halfH} r={2} fill={theme.palette.text.primary} />
      {/* Stub down to hinge */}
      <line
        x1={0}
        y1={-halfH}
        x2={0}
        y2={-halfH + 4}
        stroke={theme.palette.text.primary}
        strokeWidth={2}
      />
      {/* Rectangle outline (status box) */}
      <rect
        x={-halfW}
        y={-halfH + 4}
        width={halfW * 2}
        height={halfH * 2 - 4}
        fill="none"
        stroke={color}
        strokeWidth={2}
        rx={1}
      />
      {/* Bottom hinge dot */}
      <circle cx={0} cy={halfH - 2} r={2} fill={color} />
      {/* Knife arm */}
      {isClosed ? (
        <line
          x1={0}
          y1={halfH - 2}
          x2={0}
          y2={-halfH + 6}
          stroke={color}
          strokeWidth={2.5}
        />
      ) : (
        <line
          x1={0}
          y1={halfH - 2}
          x2={halfW - 2}
          y2={-halfH + 8}
          stroke={color}
          strokeWidth={2.5}
        />
      )}
      {/* Top contact point (where arm meets when closed) */}
      <circle cx={0} cy={-halfH + 6} r={1.5} fill={theme.palette.text.primary} />
      {/* Bottom connection point (transformer side) */}
      <line
        x1={0}
        y1={halfH - 2}
        x2={0}
        y2={halfH}
        stroke={theme.palette.text.primary}
        strokeWidth={2}
      />
      <circle cx={0} cy={halfH} r={2} fill={theme.palette.text.primary} />
      {/* Label to the right */}
      {label && (
        <text
          x={halfW + 10}
          y={5}
          fontSize={SLD_FONT.switchLabel}
          fontFamily="monospace"
          fontWeight="bold"
          fill={theme.palette.text.primary}
        >
          {label}
        </text>
      )}
      <AlarmIndicator state={state} offsetX={halfW + 4} offsetY={-halfH - 4} />
    </g>
  );
};

export default Switch;
