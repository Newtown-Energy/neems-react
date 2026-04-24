import React from 'react';
import { useTheme } from '@mui/material';
import type { SldElementProps } from '../types';
import AlarmIndicator from './AlarmIndicator';
import { SLD_FONT } from '../sldTypography';

/**
 * Feeder circuit breaker (Megapack breaker). Rendered as a filled square:
 *   closed → red
 *   open → green
 * Designation (e.g. "52-MP1A") sits centered on the square.
 */
const CircuitBreaker: React.FC<SldElementProps> = ({
  x,
  y,
  state,
  label,
  onClick,
}) => {
  const theme = useTheme();
  const isOpen = state.switchPosition === 'open';
  const color = isOpen ? theme.palette.success.main : theme.palette.error.main;
  const stubColor = theme.palette.text.primary;

  const size = 14; // half-size

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Stubs in/out */}
      <line
        x1={0}
        y1={-size - 6}
        x2={0}
        y2={-size}
        stroke={stubColor}
        strokeWidth={2}
      />
      <circle cx={0} cy={-size - 6} r={2} fill={stubColor} />
      <line
        x1={0}
        y1={size}
        x2={0}
        y2={size + 6}
        stroke={stubColor}
        strokeWidth={2}
      />
      <circle cx={0} cy={size + 6} r={2} fill={stubColor} />
      {/* Filled breaker square */}
      <rect
        x={-size}
        y={-size}
        width={size * 2}
        height={size * 2}
        fill={color}
        stroke={color}
        strokeWidth={2}
        rx={2}
      />
      {/* Label below the square (moved outside so longer designations like "52-MP-1A" don't clip).
          A background rect under the text keeps it readable where it crosses the wire to the megapack. */}
      {label && (
        <>
          <rect
            x={-label.length * 4.45}
            y={size + 13}
            width={label.length * 8.9}
            height={17}
            fill={theme.palette.background.paper}
            rx={2}
          />
          <text
            x={0}
            y={size + 26}
            textAnchor="middle"
            fontSize={SLD_FONT.label}
            fontFamily="monospace"
            fontWeight="bold"
            fill={theme.palette.text.primary}
            style={{ pointerEvents: 'none' }}
          >
            {label}
          </text>
        </>
      )}
      <AlarmIndicator state={state} offsetX={size + 4} offsetY={-size - 4} />
    </g>
  );
};

export default CircuitBreaker;
