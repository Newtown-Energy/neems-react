import React from 'react';
import { useTheme } from '@mui/material';
import type { SldElementProps } from '../types';
import { useStatusColors } from './useStatusColors';
import AlarmIndicator from './AlarmIndicator';
import AlarmGlow from './AlarmGlow';
import WyeGroundSymbol from './WyeGroundSymbol';
import { SLD_FONT } from '../sldTypography';

/**
 * Build a horizontal winding: a row of `loops` semicircular humps along the
 * X axis, centered on x=0, each bulging by `amp` in Y (negative = up). The
 * path returns to the baseline (`y0`) at every loop boundary, and with an even
 * loop count x=0 is a boundary — so the vertical conductor meets the winding
 * cleanly on the baseline at its center.
 */
function windingPath(y0: number, loops: number, loopW: number, amp: number): string {
  const half = (loops * loopW) / 2;
  let d = `M ${-half} ${y0}`;
  for (let i = 0; i < loops; i += 1) {
    const xMid = -half + i * loopW + loopW / 2;
    const xEnd = -half + (i + 1) * loopW;
    d += ` Q ${xMid} ${y0 + amp}, ${xEnd} ${y0}`;
  }
  return d;
}

/**
 * Transformer: the conventional two-winding symbol — two rows of upward coil
 * humps (primary above, secondary below) coupled across a two-line iron core.
 * A wye-ground topology mark sits beside each winding to indicate the site's
 * Y/Y-ground configuration.
 */
const Transformer: React.FC<SldElementProps> = ({ x, y, state, label }) => {
  const theme = useTheme();
  const { stroke, strokeWidth } = useStatusColors(state);
  const lineColor = state.status === 'normal' ? theme.palette.text.primary : stroke;

  const loops = 4;
  const loopW = 6;
  const amp = 6;
  const halfW = (loops * loopW) / 2; // 12

  // Both windings are drawn as a row of upward humps with the two iron-core
  // lines between them. Each winding's baseline (where the path returns between
  // humps) is its connection point; the vertical conductor meets it at center.
  const primaryBaseline = -8; // top winding
  const secondaryBaseline = 14; // bottom winding
  const coreGap = 4; // spacing between the two iron-core lines

  const stubTopY = -24;
  const stubBottomY = 24;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Pulsing severity glow — bounding rect around both windings for Emergency/Critical */}
      <AlarmGlow state={state} halfW={halfW + 2} halfH={14} />

      {/* Top stub */}
      <line x1={0} y1={stubTopY} x2={0} y2={primaryBaseline} stroke={lineColor} strokeWidth={2} />
      <circle cx={0} cy={stubTopY} r={2} fill={lineColor} />

      {/* Primary winding (row of upward humps) */}
      <path
        d={windingPath(primaryBaseline, loops, loopW, -amp)}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
      />
      {/* Secondary winding (row of upward humps) */}
      <path
        d={windingPath(secondaryBaseline, loops, loopW, -amp)}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
      />

      {/* Iron core: two parallel horizontal lines between the windings */}
      <line
        x1={-halfW}
        y1={-coreGap / 2}
        x2={halfW}
        y2={-coreGap / 2}
        stroke={lineColor}
        strokeWidth={1}
      />
      <line
        x1={-halfW}
        y1={coreGap / 2}
        x2={halfW}
        y2={coreGap / 2}
        stroke={lineColor}
        strokeWidth={1}
      />

      {/* Bottom stub */}
      <line x1={0} y1={secondaryBaseline} x2={0} y2={stubBottomY} stroke={lineColor} strokeWidth={2} />
      <circle cx={0} cy={stubBottomY} r={2} fill={lineColor} />

      {/* Wye-ground topology marks beside each winding */}
      <WyeGroundSymbol x={24} y={primaryBaseline - 3} color={lineColor} scale={0.55} />
      <WyeGroundSymbol x={24} y={secondaryBaseline - 3} color={lineColor} scale={0.55} />

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
