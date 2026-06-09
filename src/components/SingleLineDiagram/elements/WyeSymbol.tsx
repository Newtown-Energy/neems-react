import React from 'react';

interface WyeSymbolProps {
  x: number;
  y: number;
  color: string;
  scale?: number;
}

/**
 * Wye (star) winding mark with a downward lead arrow: three spokes meeting at a
 * point (one up, two down at 120°) with the lead continuing down to a
 * downward-pointing arrowhead. Used to annotate transformer winding topology —
 * the wye counterpart to a delta (triangle).
 */
const WyeSymbol: React.FC<WyeSymbolProps> = ({ x, y, color, scale = 1 }) => {
  const arm = 9 * scale; // up spoke + diagonal arms
  const dx = 0.866 * arm; // sin(60°)
  const dy = 0.5 * arm; // cos(60°)
  const stem = 16 * scale; // lead length from the junction to the arrow tip
  const head = 3.6 * scale; // arrowhead size
  const sw = 1.4;
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Wye: up spoke + two down-diagonal spokes */}
      <line x1={0} y1={0} x2={0} y2={-arm} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <line x1={0} y1={0} x2={-dx} y2={dy} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <line x1={0} y1={0} x2={dx} y2={dy} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* Lead continuing down to a downward arrowhead */}
      <line x1={0} y1={0} x2={0} y2={stem} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <line x1={0} y1={stem} x2={-head} y2={stem - head} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <line x1={0} y1={stem} x2={head} y2={stem - head} stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </g>
  );
};

export default WyeSymbol;
