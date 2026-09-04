import React from 'react';
import { useTheme } from '@mui/material';
import type { ControlRequestView } from '../../../utils/useSiteControls';
import { SLD_FONT } from '../sldTypography';

interface ControlRequestBadgeProps {
  /** What became of the operator's click, or `null` when there is nothing to say. */
  request: ControlRequestView | null;
  /** Placement relative to the element's own origin. */
  offsetX: number;
  offsetY: number;
}

/**
 * What became of an operator's click, drawn beside the element they clicked.
 *
 * This is the *request*, never the equipment. A breaker that has not moved
 * still draws its own position from its readback point; this badge only ever
 * says whether the ask got out. The two are separate axes and the diagram must
 * not let one stand in for the other — which is why this is a distinct mark
 * rather than a change to the symbol's own color or contact.
 */
const ControlRequestBadge: React.FC<ControlRequestBadgeProps> = ({
  request,
  offsetX,
  offsetY,
}) => {
  const theme = useTheme();
  if (!request) return null;

  const { status, action } = request;
  const color =
    status === 'failed'
      ? theme.palette.error.main
      : status === 'sent'
        ? theme.palette.success.main
        : theme.palette.warning.main;

  // Short enough to sit beside a breaker without covering its neighbour. The
  // reason for a failure goes in the banner, where there is room for words.
  const text = status === 'failed' ? 'FAILED' : status === 'sent' ? 'SENT' : `${action.toUpperCase()}…`;
  const width = text.length * 7.4 + 10;

  return (
    <g
      transform={`translate(${offsetX}, ${offsetY})`}
      style={{ pointerEvents: 'none' }}
      data-testid={`control-request-${status}`}
      aria-hidden
    >
      <rect
        x={0}
        y={-8}
        width={width}
        height={16}
        rx={8}
        fill={theme.palette.background.paper}
        stroke={color}
        strokeWidth={1.5}
      >
        {/* A request still on its way pulses, so the wait reads as activity
            rather than as a diagram that has stopped responding. */}
        {status === 'pending' && (
          <animate
            attributeName="opacity"
            values="1;0.45;1"
            dur="1.1s"
            repeatCount="indefinite"
          />
        )}
      </rect>
      <text
        x={width / 2}
        y={4}
        textAnchor="middle"
        fontSize={SLD_FONT.badge}
        fontFamily="monospace"
        fontWeight="bold"
        fill={color}
      >
        {text}
      </text>
    </g>
  );
};

export default ControlRequestBadge;
