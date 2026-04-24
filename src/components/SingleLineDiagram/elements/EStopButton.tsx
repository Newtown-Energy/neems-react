import React from 'react';
import { useTheme } from '@mui/material';

interface EStopButtonProps {
  x: number;
  y: number;
  active: boolean;
  onClick: () => void;
}

/**
 * Large round E-stop button rendered directly into the SVG.
 * When `active` is false: red circle with white "E-STOP" text.
 * When `active` is true: inverted (outlined) style with "REMOVE E-STOP".
 * The caller owns confirmation dialogs; this component only reports clicks.
 */
const EStopButton: React.FC<EStopButtonProps> = ({ x, y, active, onClick }) => {
  const theme = useTheme();
  const red = theme.palette.error.main;

  const r = 44;
  const fill = active ? theme.palette.background.paper : red;
  const textColor = active ? red : '#ffffff';
  const label = active ? 'REMOVE' : 'E-STOP';
  const subLabel = active ? 'E-STOP' : null;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Outer bezel */}
      <circle cx={0} cy={0} r={r + 3} fill={red} opacity={active ? 0.25 : 0.4} />
      {/* Button body */}
      <circle
        cx={0}
        cy={0}
        r={r}
        fill={fill}
        stroke={red}
        strokeWidth={3}
      />
      {/* Primary label */}
      <text
        x={0}
        y={subLabel ? -2 : 6}
        textAnchor="middle"
        fontSize={subLabel ? 13 : 16}
        fontFamily="sans-serif"
        fontWeight="bold"
        fill={textColor}
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {label}
      </text>
      {subLabel && (
        <text
          x={0}
          y={14}
          textAnchor="middle"
          fontSize={13}
          fontFamily="sans-serif"
          fontWeight="bold"
          fill={textColor}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {subLabel}
        </text>
      )}
    </g>
  );
};

export default EStopButton;
