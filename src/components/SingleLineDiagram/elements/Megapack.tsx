import React from 'react';
import { useTheme } from '@mui/material';
import type { SldElementProps } from '../types';
import { useStatusColors } from './useStatusColors';
import AlarmIndicator from './AlarmIndicator';
import { SLD_FONT } from '../sldTypography';

const FIRE_RELATED_KEYWORDS = ['high temp', 'hi temp', 'sparker', 'fire'];

function hasFireRelatedAlarm(
  state: SldElementProps['state'],
): boolean {
  return state.activeAlarms.some((a) =>
    FIRE_RELATED_KEYWORDS.some((kw) => a.name.toLowerCase().includes(kw)),
  );
}

function formatAnalog(value: number | null | undefined, unit: string): string {
  if (value == null || Number.isNaN(value)) return `-- ${unit}`;
  return `${value.toFixed(unit === '%' ? 0 : 1)} ${unit}`;
}

/**
 * Megapack 2XL battery unit.
 * Shape: a tall rectangle with five small circles stacked along its right side
 * (representing the stack "fans"/vents on the back panel).
 * Below the symbol, three value slots show SOC, Max Stack Temp, and Output Voltage.
 * Outline goes red when any active alarm name matches a fire-related keyword.
 */
const Megapack: React.FC<SldElementProps> = ({ x, y, state, label }) => {
  const theme = useTheme();
  const { stroke, fill, strokeWidth } = useStatusColors(state);
  const fireAlarm = hasFireRelatedAlarm(state);

  const baseColor =
    state.status === 'normal' ? theme.palette.text.primary : stroke;
  const lineColor = fireAlarm ? theme.palette.error.main : baseColor;
  const bgFill = fireAlarm
    ? `${theme.palette.error.main}22`
    : state.status === 'normal'
      ? 'none'
      : fill;

  const w = 40;
  const h = 54;
  const fanCount = 5;

  // Fan circle positions (right-side column)
  const fanXOffset = w / 2 - 6;
  const fanSpacing = (h - 14) / (fanCount - 1);
  const fanYStart = -h / 2 + 7;

  // Analog slots
  const soc = state.analogs?.soc ?? null;
  const stackTemp = state.analogs?.stackTemp ?? null;
  const outputV = state.analogs?.outputVoltage ?? null;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Top connection stub */}
      <circle cx={0} cy={-h / 2} r={2} fill={baseColor} />
      {/* Body */}
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        fill={bgFill}
        stroke={lineColor}
        strokeWidth={strokeWidth}
        rx={2}
      />
      {/* Charge bar graph — vertical fill proportional to SOC%.
          Rendered behind the fan circles. Clamped to [0, 100]. */}
      {soc != null && !Number.isNaN(soc) && (() => {
        const pct = Math.max(0, Math.min(100, soc));
        const innerW = w - 4;
        const innerH = h - 4;
        const barH = (pct / 100) * innerH;
        const barY = h / 2 - 2 - barH;
        return (
          <rect
            x={-w / 2 + 2}
            y={barY}
            width={innerW}
            height={barH}
            fill={theme.palette.success.main}
            opacity={0.3}
            rx={1}
          />
        );
      })()}
      {/* Five stack-fan circles (back-panel indicators) */}
      {Array.from({ length: fanCount }).map((_, i) => {
        const cy = fanYStart + i * fanSpacing;
        return (
          <circle
            key={`fan-${cy}`}
            cx={fanXOffset}
            cy={cy}
            r={2.2}
            fill="none"
            stroke={lineColor}
            strokeWidth={1}
          />
        );
      })}
      {/* Label above the body */}
      {label && (
        <text
          x={0}
          y={-h / 2 - 8}
          textAnchor="middle"
          fontSize={SLD_FONT.label}
          fontFamily="monospace"
          fontWeight="bold"
          fill={theme.palette.text.primary}
        >
          {label}
        </text>
      )}

      {/* Analog slots below the body */}
      <g transform={`translate(0, ${h / 2 + 8})`}>
        <text
          x={0}
          y={10}
          textAnchor="middle"
          fontSize={SLD_FONT.analog}
          fontFamily="monospace"
          fill={theme.palette.text.secondary}
        >
          Charge {formatAnalog(soc, '%')}
        </text>
        <text
          x={0}
          y={24}
          textAnchor="middle"
          fontSize={SLD_FONT.analog - 2}
          fontFamily="monospace"
          fontStyle="italic"
          fill={theme.palette.text.secondary}
        >
          (per Tesla Controller)
        </text>
        <text
          x={0}
          y={40}
          textAnchor="middle"
          fontSize={SLD_FONT.analog}
          fontFamily="monospace"
          fill={theme.palette.text.secondary}
        >
          T {formatAnalog(stackTemp, '°C')}
        </text>
        <text
          x={0}
          y={56}
          textAnchor="middle"
          fontSize={SLD_FONT.analog}
          fontFamily="monospace"
          fill={theme.palette.text.secondary}
        >
          V {formatAnalog(outputV, 'V')}
        </text>
      </g>

      <AlarmIndicator state={state} offsetX={w / 2 + 4} offsetY={-h / 2 - 4} />
    </g>
  );
};

export default Megapack;
