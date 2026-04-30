import React from 'react';
import { useTheme } from '@mui/material';
import type { SldElementProps } from '../types';
import { useStatusColors } from './useStatusColors';
import AlarmIndicator from './AlarmIndicator';
import AlarmGlow from './AlarmGlow';
import { SLD_FONT } from '../sldTypography';

/**
 * SEL-451 protective relay, rendered off the main power path.
 * Dashed control lines from this element to the switches it commands are
 * drawn by the layout using `Wire` with the `control` variant.
 */
const Sel451Relay: React.FC<SldElementProps> = ({
  x,
  y,
  state,
  label = 'SEL-451',
}) => {
  const theme = useTheme();
  const { stroke, fill, strokeWidth } = useStatusColors(state);
  const lineColor = state.status === 'normal' ? theme.palette.text.primary : stroke;
  const bgFill = state.status === 'normal' ? theme.palette.background.paper : fill;

  const w = 110;
  const h = 52;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Pulsing severity glow — behind the relay box for Emergency/Critical */}
      <AlarmGlow state={state} halfW={w / 2} halfH={h / 2} />
      {/* Box */}
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        fill={bgFill}
        stroke={lineColor}
        strokeWidth={strokeWidth}
        rx={3}
      />
      <text
        x={0}
        y={-2}
        textAnchor="middle"
        fontSize={SLD_FONT.header}
        fontFamily="monospace"
        fontWeight="bold"
        fill={lineColor}
      >
        {label}
      </text>
      <text
        x={0}
        y={18}
        textAnchor="middle"
        fontSize={SLD_FONT.subtitle}
        fontFamily="monospace"
        fill={theme.palette.text.secondary}
      >
        Relay
      </text>
      <AlarmIndicator state={state} offsetX={w / 2 + 4} offsetY={-h / 2 - 4} />
    </g>
  );
};

export default Sel451Relay;
