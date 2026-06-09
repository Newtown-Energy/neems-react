import React from 'react';

interface WyeSymbolProps {
  x: number;
  y: number;
  color: string;
  scale?: number;
}

/**
 * Wye (star) winding symbol: three spokes meeting at a point, 120° apart (one
 * up, two down). Used to annotate transformer winding topology — the wye
 * counterpart to a delta (triangle).
 */
const WyeSymbol: React.FC<WyeSymbolProps> = ({ x, y, color, scale = 1 }) => {
  const len = 9 * scale;
  const dx = 0.866 * len; // sin(60°)
  const dy = 0.5 * len; // cos(60°)
  return (
    <g transform={`translate(${x}, ${y})`}>
      <line x1={0} y1={0} x2={0} y2={-len} stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <line x1={0} y1={0} x2={-dx} y2={dy} stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <line x1={0} y1={0} x2={dx} y2={dy} stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </g>
  );
};

export default WyeSymbol;
