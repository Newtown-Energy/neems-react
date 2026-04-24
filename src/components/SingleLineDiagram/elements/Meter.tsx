import React from 'react';
import { useTheme } from '@mui/material';
import type { SldElementProps } from '../types';
import { useStatusColors } from './useStatusColors';
import AlarmIndicator from './AlarmIndicator';
import { SLD_FONT } from '../sldTypography';

interface MeterProps extends SldElementProps {
  /** Main power line X-coordinate — a horizontal CT tap line is drawn from the meter to this X. */
  tapToX?: number;
  /** Secondary label shown below the primary (e.g. device tag "SEL-735"). */
  secondaryLabel?: string;
}

function formatAnalog(value: number | null | undefined, unit: string): string {
  if (value == null || Number.isNaN(value)) return `-- ${unit}`;
  return `${value.toFixed(1)} ${unit}`;
}

/**
 * Metering point: M-in-circle with a short horizontal CT tap line back to the
 * main line at `tapToX`, plus a stack of four analog slots (kW / kVar / V / A).
 */
const Meter: React.FC<MeterProps> = ({
  x,
  y,
  state,
  label = 'MT1',
  secondaryLabel = 'SEL-735',
  tapToX,
}) => {
  const theme = useTheme();
  const { stroke } = useStatusColors(state);
  const lineColor =
    state.status === 'normal' || state.status === 'offline'
      ? theme.palette.text.primary
      : stroke;
  const dimmed = state.status === 'offline';
  const effectiveColor = dimmed ? theme.palette.action.disabled : lineColor;

  const r = 14;

  const kW = state.analogs?.kW ?? null;
  const kVar = state.analogs?.kVar ?? null;
  const voltage = state.analogs?.voltage ?? null;
  const amps = state.analogs?.amps ?? null;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* CT tap line back to the main power line */}
      {tapToX != null && (
        <line
          x1={r}
          y1={0}
          x2={tapToX - x}
          y2={0}
          stroke={effectiveColor}
          strokeWidth={1.5}
          strokeDasharray="3 2"
        />
      )}
      {/* Meter circle */}
      <circle
        cx={0}
        cy={0}
        r={r}
        fill={theme.palette.background.paper}
        stroke={effectiveColor}
        strokeWidth={2}
      />
      <text
        x={0}
        y={5}
        textAnchor="middle"
        fontSize={SLD_FONT.header}
        fontFamily="monospace"
        fontWeight="bold"
        fill={effectiveColor}
      >
        M
      </text>
      {/* Device label beside the circle */}
      <text
        x={-r - 6}
        y={-2}
        textAnchor="end"
        fontSize={SLD_FONT.label}
        fontFamily="monospace"
        fontWeight="bold"
        fill={theme.palette.text.primary}
      >
        {label}
      </text>
      <text
        x={-r - 6}
        y={13}
        textAnchor="end"
        fontSize={SLD_FONT.subtitle}
        fontFamily="monospace"
        fill={theme.palette.text.secondary}
      >
        {secondaryLabel}
      </text>

      {/* Analog slots below */}
      <g transform={`translate(0, ${r + 8})`}>
        {[
          ['kW', formatAnalog(kW, 'kW')],
          ['kVar', formatAnalog(kVar, 'kVar')],
          ['V', formatAnalog(voltage, 'V')],
          ['A', formatAnalog(amps, 'A')],
        ].map(([labelText, value], i) => (
          <text
            key={labelText}
            x={0}
            y={11 + i * 16}
            textAnchor="middle"
            fontSize={SLD_FONT.analog}
            fontFamily="monospace"
            fill={theme.palette.text.secondary}
          >
            {value}
          </text>
        ))}
      </g>

      <AlarmIndicator state={state} offsetX={r + 4} offsetY={-r - 4} />
    </g>
  );
};

export default Meter;
