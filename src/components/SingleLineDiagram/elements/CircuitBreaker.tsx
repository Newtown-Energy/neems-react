import React from 'react';
import { useTheme } from '@mui/material';
import type { SldElementProps } from '../types';
import { useStatusColors } from './useStatusColors';
import AlarmIndicator from './AlarmIndicator';

/**
 * IEC circuit breaker symbol.
 * Closed: a small square with a vertical line through it.
 * Open: a small square with a diagonal line (contact swung open).
 */
const CircuitBreaker: React.FC<SldElementProps> = ({ x, y, state, label, onClick }) => {
  const theme = useTheme();
  const { stroke, strokeWidth } = useStatusColors(state);
  const lineColor = state.status === 'normal' ? theme.palette.text.primary : stroke;
  const isOpen = state.switchPosition === 'open';

  const size = 10; // half-size of the breaker square

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Connection point top */}
      <circle cx={0} cy={-size} r={2} fill={lineColor} />
      {/* Breaker body (square) */}
      <rect
        x={-size}
        y={-size}
        width={size * 2}
        height={size * 2}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
      />
      {/* Contact line: vertical when closed, diagonal when open */}
      {isOpen ? (
        <line
          x1={0}
          y1={-size}
          x2={size * 0.8}
          y2={size * 0.6}
          stroke={lineColor}
          strokeWidth={strokeWidth}
        />
      ) : (
        <line
          x1={0}
          y1={-size}
          x2={0}
          y2={size}
          stroke={lineColor}
          strokeWidth={strokeWidth}
        />
      )}
      {/* Connection point bottom */}
      <circle cx={0} cy={size} r={2} fill={lineColor} />
      {/* "X" mark for breaker (standard notation) */}
      <line x1={-size} y1={-size} x2={size} y2={size} stroke={lineColor} strokeWidth={1} opacity={0.3} />
      <line x1={size} y1={-size} x2={-size} y2={size} stroke={lineColor} strokeWidth={1} opacity={0.3} />
      {/* Label */}
      {label && (
        <text
          x={size + 6}
          y={4}
          fontSize={9}
          fontFamily="monospace"
          fill={theme.palette.text.primary}
        >
          {label}
        </text>
      )}
      <AlarmIndicator state={state} offsetX={size + 4} offsetY={-size - 4} />
    </g>
  );
};

export default CircuitBreaker;
