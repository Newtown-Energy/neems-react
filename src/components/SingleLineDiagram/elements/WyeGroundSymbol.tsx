import React from 'react';

interface WyeGroundSymbolProps {
  x: number;
  y: number;
  color: string;
  scale?: number;
}

/**
 * Small wye (Y) with ground-connection symbol used to annotate transformer
 * winding topology. Three legs meeting at a point, with a ground bracket below.
 */
const WyeGroundSymbol: React.FC<WyeGroundSymbolProps> = ({
  x,
  y,
  color,
  scale = 1,
}) => {
  const s = scale;
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Three Y legs meeting at origin */}
      <line x1={0} y1={0} x2={-6 * s} y2={-7 * s} stroke={color} strokeWidth={1.2} />
      <line x1={0} y1={0} x2={6 * s} y2={-7 * s} stroke={color} strokeWidth={1.2} />
      <line x1={0} y1={0} x2={0} y2={-8 * s} stroke={color} strokeWidth={1.2} />
      {/* Stem down to ground */}
      <line x1={0} y1={0} x2={0} y2={5 * s} stroke={color} strokeWidth={1.2} />
      {/* Ground bars (three decreasing) */}
      <line x1={-6 * s} y1={5 * s} x2={6 * s} y2={5 * s} stroke={color} strokeWidth={1.2} />
      <line x1={-4 * s} y1={7 * s} x2={4 * s} y2={7 * s} stroke={color} strokeWidth={1.2} />
      <line x1={-2 * s} y1={9 * s} x2={2 * s} y2={9 * s} stroke={color} strokeWidth={1.2} />
    </g>
  );
};

export default WyeGroundSymbol;
