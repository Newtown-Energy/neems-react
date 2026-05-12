/**
 * Per-day command bar visualization.
 *
 * Demo Script v2 wants each day cell to render the day's commands as
 * horizontal bars stacked on a 24-hour timeline:
 *
 *   - Discharge bars sit above the zero line, in blue.
 *   - Charge bars (full power) sit below the zero line, in orange.
 *   - Trickle-charge bars also sit below in a muted orange.
 *
 * The component is intentionally tiny and SVG-based so it scales cleanly
 * inside the calendar cell. The y-axis is unitless (heights are scaled to
 * a constant — power magnitudes are not yet stored per-command, so the
 * site's max output is used as the reference).
 */

import React from 'react';
import type { ScheduleCommandDto } from '@newtown-energy/types';

import { COMMAND_BAR_COLORS, secondsToTime } from '../../utils/scheduleHelpers';

interface DayBarChartProps {
  commands: ScheduleCommandDto[];
  /** Optional site max output in kW, used only for the tooltip label. */
  sitePowerKw?: number | null;
  height?: number;
}

const TOTAL_SECONDS = 86400;

/**
 * Compute the SVG geometry for a single command. Returns null if the
 * command has no `duration_seconds` — the data model allows null but for
 * the demo every command has a duration.
 */
function commandBar(
  cmd: ScheduleCommandDto,
  axisY: number,
  barHeight: number
): { x: number; y: number; width: number; height: number; fill: string } | null {
  if (cmd.duration_seconds == null || cmd.duration_seconds <= 0) return null;
  const startPct = (cmd.execution_offset_seconds / TOTAL_SECONDS) * 100;
  const widthPct = Math.min(
    100 - startPct,
    (cmd.duration_seconds / TOTAL_SECONDS) * 100
  );
  const fill = COMMAND_BAR_COLORS[cmd.command_type];
  // Discharge goes up (negative y in SVG); charge / trickle go down.
  if (cmd.command_type === 'discharge') {
    return { x: startPct, y: axisY - barHeight, width: widthPct, height: barHeight, fill };
  }
  return { x: startPct, y: axisY, width: widthPct, height: barHeight, fill };
}

const DayBarChart: React.FC<DayBarChartProps> = ({ commands, sitePowerKw, height = 32 }) => {
  // Half above zero (discharge), half below (charge).
  const axisY = height / 2;
  const barHeight = axisY - 2; // 2px breathing room top/bottom

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
      role="img"
      aria-label="Charge/discharge schedule for this day"
    >
      <line x1={0} x2={100} y1={axisY} y2={axisY} stroke="#bdbdbd" strokeWidth={0.5} />
      {commands.map(cmd => {
        const bar = commandBar(cmd, axisY, barHeight);
        if (!bar) return null;
        const power = sitePowerKw ? ` @ ~${Math.round(sitePowerKw)} kW` : '';
        const endSeconds = Math.min(
          TOTAL_SECONDS,
          cmd.execution_offset_seconds + (cmd.duration_seconds ?? 0)
        );
        const tooltip = `${cmd.command_type.replace('_', ' ')} ${secondsToTime(cmd.execution_offset_seconds)}–${secondsToTime(endSeconds)}${power}`;
        return (
          <rect
            key={cmd.id}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            fill={bar.fill}
            opacity={0.85}
          >
            <title>{tooltip}</title>
          </rect>
        );
      })}
    </svg>
  );
};

export default DayBarChart;
