import React from 'react';
import { useTheme } from '@mui/material';
import type { EStopDisplayState } from '../types';
import { SLD_FONT } from '../sldTypography';

interface EStopIndicatorProps {
  x: number;
  y: number;
  state: EStopDisplayState;
}

/**
 * The site's physical E-stop, as the RTAC reports it (alarm 104).
 *
 * Read-only. The E-stop is a button on site and nothing in this interface can
 * press or clear it; this only shows what the site says about it. Asking the
 * site to shut down is the Emergency Shutdown button's job, and that request
 * never moves this indicator — only alarm 104 does.
 *
 * - normal: "E-STOP / NORMAL" in the theme's ordinary line color.
 * - tripped: solid red, "E-STOP / TRIPPED", with a flashing red halo, per the
 *   alarm spreadsheet's "Main obj: Red, flashing, tripped". The halo flashes,
 *   not the box, so the white label always sits on solid red and stays
 *   readable in either theme.
 * - unknown: greyed, "E-STOP / UNKNOWN". With no reading at all the site has
 *   told us nothing, and "normal" is exactly the reading an operator would
 *   take as all clear.
 */
const EStopIndicator: React.FC<EStopIndicatorProps> = ({ x, y, state }) => {
  const theme = useTheme();
  const red = theme.palette.error.main;
  const tripped = state === 'tripped';

  const w = 96;
  const h = 40;

  const lineColor = tripped
    ? red
    : state === 'unknown'
      ? theme.palette.text.disabled
      : theme.palette.text.primary;
  const fill = tripped ? red : theme.palette.background.paper;
  const textColor = tripped ? '#ffffff' : lineColor;

  const stateLabel = tripped ? 'TRIPPED' : state === 'unknown' ? 'UNKNOWN' : 'NORMAL';
  const title = tripped
    ? 'Site E-stop is tripped — clear it at the panel on site'
    : state === 'unknown'
      ? 'Site E-stop state is unknown — no reading from the site'
      : 'Site E-stop is not tripped';

  return (
    <g
      transform={`translate(${x}, ${y})`}
      role="img"
      aria-label={title}
      data-testid="sld-estop-indicator"
      data-estop-state={state}
    >
      <title>{title}</title>
      {tripped && (
        <rect
          x={-w / 2 - 5}
          y={-h / 2 - 5}
          width={w + 10}
          height={h + 10}
          fill="none"
          stroke={red}
          strokeWidth={4}
          rx={7}
        >
          <animate
            attributeName="opacity"
            values="1;0.1;1"
            dur="1s"
            repeatCount="indefinite"
          />
        </rect>
      )}
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        fill={fill}
        stroke={lineColor}
        strokeWidth={tripped ? 3 : 2}
        strokeDasharray={state === 'unknown' ? '4 3' : undefined}
        rx={4}
      />
      <text
        x={0}
        y={-3}
        textAnchor="middle"
        fontSize={SLD_FONT.label}
        fontFamily="monospace"
        fontWeight="bold"
        fill={textColor}
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        E-STOP
      </text>
      <text
        x={0}
        y={13}
        textAnchor="middle"
        fontSize={SLD_FONT.badge}
        fontFamily="monospace"
        fontWeight="bold"
        fill={textColor}
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {stateLabel}
      </text>
    </g>
  );
};

export default EStopIndicator;
