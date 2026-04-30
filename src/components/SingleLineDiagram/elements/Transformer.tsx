import React from 'react';
import { useTheme } from '@mui/material';
import type { SldElementProps } from '../types';
import { useStatusColors } from './useStatusColors';
import AlarmIndicator from './AlarmIndicator';
import AlarmGlow from './AlarmGlow';
import WyeGroundSymbol from './WyeGroundSymbol';
import { SLD_FONT } from '../sldTypography';

/**
 * Build a vertical coil path with `humpCount` humps bulging to the right
 * (positive X). The path starts at (0, yStart) and ends at (0, yStart + height).
 */
function coilPath(yStart: number, humpCount: number, humpHeight: number): string {
  let d = `M 0 ${yStart}`;
  for (let i = 0; i < humpCount; i += 1) {
    const yMid = yStart + i * humpHeight + humpHeight / 2;
    const yEnd = yStart + (i + 1) * humpHeight;
    d += ` Q 8 ${yMid}, 0 ${yEnd}`;
  }
  return d;
}

/**
 * Transformer: two vertically-stacked squiggly coils (primary above,
 * secondary below) with a wye-ground topology mark beside each winding to
 * indicate the Y/Y-ground configuration used at Brigis 1A.
 */
const Transformer: React.FC<SldElementProps> = ({ x, y, state, label }) => {
  const theme = useTheme();
  const { stroke, strokeWidth } = useStatusColors(state);
  const lineColor = state.status === 'normal' ? theme.palette.text.primary : stroke;

  const humpHeight = 5;
  const humpCount = 3;
  const coilHeight = humpHeight * humpCount; // 15
  const gap = 4; // vertical gap between primary and secondary coils

  const primaryTop = -coilHeight - gap / 2;
  const primaryBottom = primaryTop + coilHeight;
  const secondaryTop = primaryBottom + gap;
  const secondaryBottom = secondaryTop + coilHeight;

  // Short stub connectors into/out of the coils
  const stubTopY = primaryTop - 6;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Pulsing severity glow — bounding rect around both windings for Emergency/Critical */}
      <AlarmGlow state={state} halfW={14} halfH={coilHeight + gap / 2 + 2} />
      {/* Top stub */}
      <line x1={0} y1={-24} x2={0} y2={primaryTop} stroke={lineColor} strokeWidth={2} />
      <circle cx={0} cy={-24} r={2} fill={lineColor} />

      {/* Primary winding */}
      <path
        d={coilPath(primaryTop, humpCount, humpHeight)}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
      />
      {/* Secondary winding */}
      <path
        d={coilPath(secondaryTop, humpCount, humpHeight)}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
      />

      {/* Iron-core indicator (two short parallel lines between coils) */}
      <line
        x1={-6}
        y1={primaryBottom + gap / 2 - 1}
        x2={10}
        y2={primaryBottom + gap / 2 - 1}
        stroke={lineColor}
        strokeWidth={0.8}
      />
      <line
        x1={-6}
        y1={primaryBottom + gap / 2 + 1}
        x2={10}
        y2={primaryBottom + gap / 2 + 1}
        stroke={lineColor}
        strokeWidth={0.8}
      />

      {/* Bottom stub */}
      <line x1={0} y1={secondaryBottom} x2={0} y2={24} stroke={lineColor} strokeWidth={2} />
      <circle cx={0} cy={24} r={2} fill={lineColor} />

      {/* Wye-ground topology marks beside each winding */}
      <WyeGroundSymbol
        x={24}
        y={primaryTop + coilHeight / 2}
        color={lineColor}
        scale={0.55}
      />
      <WyeGroundSymbol
        x={24}
        y={secondaryTop + coilHeight / 2}
        color={lineColor}
        scale={0.55}
      />

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
