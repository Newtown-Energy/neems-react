import React from 'react';
import { useTheme } from '@mui/material';
import type { SldElementProps } from '../types';
import { useStatusColors } from './useStatusColors';
import AlarmIndicator from './AlarmIndicator';
import AlarmGlow from './AlarmGlow';
import { SLD_FONT } from '../sldTypography';
import { gaugeFill, gaugeGeometry } from './chargeGauge';

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

  // `gaugeLevel`, not `fill`: `fill` is already the body's status color from
  // useStatusColors above.
  const gauge = gaugeGeometry(w, h);
  const gaugeLevel = gaugeFill(soc, gauge);

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Pulsing severity glow — rendered behind the body for Emergency/Critical */}
      <AlarmGlow state={state} halfW={w / 2} halfH={h / 2} />
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
      {/* Charge gauge — the spreadsheet's "MP gas gauge".
          An inset bordered track rather than a tint over the whole body: the
          body's fill and AlarmGlow already encode alarm state, and a
          measurement painted on the same rect competes with them. Giving
          charge its own bordered channel lets an operator read level and
          alarm independently.
          Drawn only when there is a reading. An empty track is
          indistinguishable from an empty pack, and those are opposite
          claims — no reading shows no gauge, matching the `--` in the text
          below. */}
      {gaugeLevel && (
        <g>
          <rect
            x={gauge.x}
            y={gauge.y}
            width={gauge.width}
            height={gauge.height}
            fill="none"
            stroke={lineColor}
            strokeWidth={0.75}
            opacity={0.7}
            rx={1}
          />
          <rect
            x={gaugeLevel.x}
            y={gaugeLevel.y}
            width={gaugeLevel.width}
            height={gaugeLevel.height}
            fill={theme.palette.success.main}
          />
        </g>
      )}
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
