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
  /**
   * Charge ceiling as a percentage of site power (0–100). Scales the
   * height of orange/charge and trickle bars below the axis. Defaults
   * to 100 (full power) when omitted, preserving prior behavior.
   */
  chargeRatePercent?: number | null;
  /**
   * Discharge ceiling as a percentage of site power (0–100). Scales
   * the height of blue/discharge bars above the axis. Defaults to 100.
   */
  dischargeRatePercent?: number | null;
  height?: number;
  /**
   * Seconds-since-midnight of the effective "now" (real wall-clock or the
   * demo-overrides forced clock). When non-null, a circular playhead marker
   * is drawn at that offset, centered on the axis. Pass null for non-today
   * cells.
   */
  nowSeconds?: number | null;
}

const TOTAL_SECONDS = 86400;

/**
 * Clamp [value] to the 0..1 range so a misconfigured site percentage
 * never breaks the SVG layout. Negative values fall back to 0; values
 * above 100 to 1.
 */
function clampUnitFraction(percent: number | null | undefined): number {
  if (percent == null || !Number.isFinite(percent)) return 1;
  if (percent <= 0) return 0;
  if (percent >= 100) return 1;
  return percent / 100;
}

/**
 * Compute the SVG geometry for a single command. Returns null if the
 * command has no `duration_seconds` — the data model allows null but for
 * the demo every command has a duration.
 *
 * Bars are scaled vertically by the site's charge/discharge rate so
 * that a charging-at-half-power site renders a half-height orange bar
 * while a full-power discharge fills the upper half of the cell.
 */
interface CommandBarLayout {
  axisY: number;
  maxBarHeight: number;
  chargeFraction: number;
  dischargeFraction: number;
}

function commandBar(
  cmd: ScheduleCommandDto,
  layout: CommandBarLayout
): { x: number; y: number; width: number; height: number; fill: string } | null {
  const { axisY, maxBarHeight, chargeFraction, dischargeFraction } = layout;
  if (cmd.duration_seconds == null || cmd.duration_seconds <= 0) return null;
  const startPct = (cmd.execution_offset_seconds / TOTAL_SECONDS) * 100;
  const widthPct = Math.min(
    100 - startPct,
    (cmd.duration_seconds / TOTAL_SECONDS) * 100
  );
  const fill = COMMAND_BAR_COLORS[cmd.command_type];
  // Discharge goes up (negative y in SVG); charge / trickle go down.
  if (cmd.command_type === 'discharge') {
    const h = maxBarHeight * dischargeFraction;
    return { x: startPct, y: axisY - h, width: widthPct, height: h, fill };
  }
  const h = maxBarHeight * chargeFraction;
  return { x: startPct, y: axisY, width: widthPct, height: h, fill };
}

const DayBarChart: React.FC<DayBarChartProps> = ({
  commands,
  sitePowerKw,
  chargeRatePercent = null,
  dischargeRatePercent = null,
  height = 32,
  nowSeconds = null
}) => {
  // Half above zero (discharge), half below (charge).
  const axisY = height / 2;
  const maxBarHeight = axisY - 2; // 2px breathing room top/bottom
  const chargeFraction = clampUnitFraction(chargeRatePercent);
  const dischargeFraction = clampUnitFraction(dischargeRatePercent);

  const nowX =
    nowSeconds != null && nowSeconds >= 0 && nowSeconds < TOTAL_SECONDS
      ? (nowSeconds / TOTAL_SECONDS) * 100
      : null;

  // The now marker is an HTML overlay rather than an SVG element: the chart
  // uses preserveAspectRatio="none", which would squash a <circle> into an
  // ellipse. A positioned <span> stays perfectly round at any cell width.
  const nowMarkerSize = Math.max(6, Math.min(height / 3, 10));

  return (
    <div style={{ position: 'relative', width: '100%', height, lineHeight: 0 }}>
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
          const bar = commandBar(cmd, { axisY, maxBarHeight, chargeFraction, dischargeFraction });
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
      {nowX != null && (
        <span
          title={`Now: ${secondsToTime(nowSeconds ?? 0)}`}
          style={{
            position: 'absolute',
            left: `${nowX}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: nowMarkerSize,
            height: nowMarkerSize,
            borderRadius: '50%',
            backgroundColor: '#424242',
            opacity: 0.85,
            pointerEvents: 'auto'
          }}
        />
      )}
    </div>
  );
};

export default DayBarChart;
