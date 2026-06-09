import React from 'react';
import { useTheme } from '@mui/material';
import type { SldElementProps } from '../types';
import { useStatusColors } from './useStatusColors';
import AlarmIndicator from './AlarmIndicator';
import AlarmGlow from './AlarmGlow';
import WyeGroundSymbol from './WyeGroundSymbol';
import { SLD_FONT } from '../sldTypography';

/**
 * Build a transformer winding: a horizontal row of `loops` semicircular lobes
 * bulging in Y by `dir` (-1 = up, +1 = down), centered on x=0. Consecutive
 * lobes meet at cusps on the baseline `y0`; with an odd loop count the middle
 * lobe's apex sits at x=0, where the vertical conductor connects.
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
 * coil lobes (primary above, secondary below) bulging away from each other,
 * cusps facing the gap between them, with the vertical conductor entering each
 * winding at its middle lobe. A wye-ground topology mark sits beside each
 * winding to indicate the site's Y/Y-ground configuration.
 */
const Transformer: React.FC<SldElementProps> = ({ x, y, state, label }) => {
  const theme = useTheme();
  const { stroke, strokeWidth } = useStatusColors(state);
  const lineColor = state.status === 'normal' ? theme.palette.text.primary : stroke;

  const loops = 3;
  const r = 5; // lobe radius
  const halfW = (loops * 2 * r) / 2; // 15
  const gap = 3; // half the spacing between the two windings' cusps

  const primaryBaseline = -gap; // top winding cusps (face the gap)
  const secondaryBaseline = gap; // bottom winding cusps
  const primaryApex = primaryBaseline - r; // where the top conductor meets the winding
  const secondaryApex = secondaryBaseline + r;

  const stubTopY = -24;
  const stubBottomY = 24;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Pulsing severity glow — bounding box around both windings */}
      <AlarmGlow state={state} halfW={halfW + 2} halfH={r + gap + 2} />

      {/* Top stub — meets the primary winding at its middle lobe apex */}
      <line x1={0} y1={stubTopY} x2={0} y2={primaryApex} stroke={lineColor} strokeWidth={2} />
      <circle cx={0} cy={stubTopY} r={2} fill={lineColor} />

      {/* Primary winding (lobes bulge up) */}
      <path
        d={windingPath(primaryBaseline, loops, r, -1)}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
      />
      {/* Secondary winding (lobes bulge down) */}
      <path
        d={windingPath(secondaryBaseline, loops, r, 1)}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
      />

      {/* Bottom stub */}
      <line x1={0} y1={secondaryApex} x2={0} y2={stubBottomY} stroke={lineColor} strokeWidth={2} />
      <circle cx={0} cy={stubBottomY} r={2} fill={lineColor} />

      {/* Wye-ground topology marks beside each winding */}
      <WyeGroundSymbol x={24} y={primaryBaseline - r / 2} color={lineColor} scale={0.55} />
      <WyeGroundSymbol x={24} y={secondaryBaseline + r / 2} color={lineColor} scale={0.55} />

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
      <AlarmIndicator state={state} offsetX={40} offsetY={stubTopY - 4} />
    </g>
  );
};

export default Transformer;
