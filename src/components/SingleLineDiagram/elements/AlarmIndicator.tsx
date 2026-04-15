import React, { useRef, useState } from 'react';
import { Chip, Popover, Stack, Typography, useTheme } from '@mui/material';
import { formatAlarmName, getSeverityColor, ZONE_DISPLAY_NAMES } from '../../../utils/alarmHelpers';
import type { SldComponentState } from '../types';

interface AlarmIndicatorProps {
  state: SldComponentState;
  offsetX: number;
  offsetY: number;
}

/**
 * A small colored badge overlay that appears on alarmed components.
 * Shows a severity-colored dot with the alarm count.
 * Pulses for Emergency/Critical alarms.
 * Clicking opens a popover with alarm details.
 */
const AlarmIndicator: React.FC<AlarmIndicatorProps> = ({ state, offsetX, offsetY }) => {
  const theme = useTheme();
  const badgeRef = useRef<SVGCircleElement>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  if (state.activeAlarmCount === 0 || !state.highestSeverity) return null;

  const colorMap: Record<string, string> = {
    Emergency: theme.palette.error.main,
    Critical: theme.palette.error.light,
    Warning: theme.palette.warning.main,
    Info: theme.palette.info.main,
  };

  const badgeColor = colorMap[state.highestSeverity] ?? theme.palette.error.main;
  const shouldPulse =
    state.highestSeverity === 'Emergency' || state.highestSeverity === 'Critical';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPopoverOpen(true);
  };

  return (
    <g transform={`translate(${offsetX}, ${offsetY})`}>
      {shouldPulse && (
        <circle cx={0} cy={0} r={10} fill={badgeColor} opacity={0.3}>
          <animate
            attributeName="r"
            values="8;12;8"
            dur="1.5s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.3;0.1;0.3"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      {/* Clickable badge circle */}
      <circle
        ref={badgeRef}
        cx={0}
        cy={0}
        r={8}
        fill={badgeColor}
        style={{ cursor: 'pointer' }}
        onClick={handleClick}
      />
      {/* Alarm count */}
      <text
        x={0}
        y={4}
        textAnchor="middle"
        fontSize={10}
        fontFamily="monospace"
        fontWeight="bold"
        fill="#fff"
        style={{ pointerEvents: 'none' }}
      >
        {state.activeAlarmCount}
      </text>

      {/* Popover with alarm details (rendered via React portal) */}
      {badgeRef.current && (
        <foreignObject width={0} height={0} overflow="visible">
          <Popover
            open={popoverOpen}
            anchorEl={badgeRef.current}
            onClose={() => setPopoverOpen(false)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            transformOrigin={{ vertical: 'top', horizontal: 'center' }}
            slotProps={{ paper: { sx: { p: 2, maxWidth: 320 } } }}
          >
            <Typography variant="subtitle2" gutterBottom>
              {ZONE_DISPLAY_NAMES[state.zone]}
            </Typography>
            <Typography variant="caption" color="text.secondary" gutterBottom component="div">
              {state.activeAlarmCount} active alarm{state.activeAlarmCount !== 1 ? 's' : ''}
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {state.activeAlarms.map((alarm) => (
                <Chip
                  key={alarm.name}
                  label={formatAlarmName(alarm.name)}
                  color={getSeverityColor(alarm.severity)}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Stack>
          </Popover>
        </foreignObject>
      )}
    </g>
  );
};

export default AlarmIndicator;
