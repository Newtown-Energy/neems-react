import React from 'react';
import { useTheme } from '@mui/material';
import type { SldElementProps } from '../types';
import { useStatusColors } from './useStatusColors';
import AlarmIndicator from './AlarmIndicator';
import AlarmGlow from './AlarmGlow';
import WyeSymbol from './WyeSymbol';
import { SLD_FONT } from '../sldTypography';

/**
 * Build a transformer winding: a horizontal row of `loops` semicircular lobes
 * bulging in Y by `dir` (-1 = up, +1 = down), centered on x=0. Consecutive
 * lobes meet at cusps on the baseline `y0`; with an even loop count a cusp sits
 * at x=0, where the vertical conductor connects.
 */
function windingPath(y0: number, loops: number, r: number, dir: number): string {
  const w = 2 * r;
  const half = (loops * w) / 2;
  const sweep = dir < 0 ? 1 : 0;
  let d = `M ${-half} ${y0}`;
  for (let i = 0; i < loops; i += 1) {
    const xEnd = -half + (i + 1) * w;
    d += ` A ${r} ${r} 0 0 ${sweep} ${xEnd} ${y0}`;
  }
  return d;
}

/**
 * Transformer: the conventional two-winding symbol — two rows of semicircular
 * coil lobes (primary above, secondary below) whose convex faces meet across
 * the central gap, with the open side of each lobe facing outward. The vertical
 * conductor connects to each winding's baseline. Two wye (star) marks sit side
 * by side beside the windings to indicate the site's Y/Y winding configuration
 * (high side and low side).
 */
const Transformer: React.FC<SldElementProps> = ({ x, y, state, label }) => {
  const theme = useTheme();
  const { stroke, strokeWidth } = useStatusColors(state);
  const lineColor = state.status === 'normal' ? theme.palette.text.primary : stroke;

  const loops = 4;
  const r = 4; // lobe radius
  const halfW = (loops * 2 * r) / 2; // 16
  const gap = 3; // spacing between the two windings' convex faces

  // Outer baselines (cusps) — where the conductor connects. Lobes bulge inward
  // toward the gap, so the open side of each half-circle faces outward.
  const primaryBaseline = -(r + gap / 2);
  const secondaryBaseline = r + gap / 2;

  const stubTopY = -24;
  const stubBottomY = 24;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Pulsing severity glow — bounding box around both windings */}
      <AlarmGlow state={state} halfW={halfW + 2} halfH={r + gap / 2 + 2} />

      {/* Top stub — meets the primary winding at its center cusp */}
      <line x1={0} y1={stubTopY} x2={0} y2={primaryBaseline} stroke={lineColor} strokeWidth={2} />
      <circle cx={0} cy={stubTopY} r={2} fill={lineColor} />

      {/* Primary winding (lobes bulge down toward the gap; open side faces up) */}
      <path
        d={windingPath(primaryBaseline, loops, r, 1)}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
      />
      {/* Secondary winding (lobes bulge up toward the gap; open side faces down) */}
      <path
        d={windingPath(secondaryBaseline, loops, r, -1)}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
      />

      {/* Bottom stub */}
      <line x1={0} y1={secondaryBaseline} x2={0} y2={stubBottomY} stroke={lineColor} strokeWidth={2} />
      <circle cx={0} cy={stubBottomY} r={2} fill={lineColor} />

      {/* Wye (star) marks, side by side beside the windings */}
      <WyeSymbol x={halfW + 6} y={0} color={lineColor} scale={0.55} />
      <WyeSymbol x={halfW + 16} y={0} color={lineColor} scale={0.55} />

      {/* Label */}
      {label && (
        <text
          x={-22}
          y={5}
          textAnchor="end"
          fontSize={SLD_FONT.label}
          fontFamily="monospace"
          fontWeight="bold"
          fill={theme.palette.text.primary}
        >
          {label}
        </text>
      )}
      <AlarmIndicator state={state} offsetX={halfW + 30} offsetY={stubTopY - 4} />
    </g>
  );
};

export default Transformer;
