import React, { useRef, useState } from 'react';
import { Box, Button, Chip, Popover, Stack, Typography, useTheme } from '@mui/material';
import { formatAlarmName, getSeverityColor, ZONE_DISPLAY_NAMES } from '../../../utils/alarmHelpers';
import type { AlarmSeverityDto } from '@newtown-energy/types';
import type { ActiveAlarmSummary, SldComponentState } from '../types';
import { SLD_FONT } from '../sldTypography';
import { severityColor } from './useStatusColors';
import {
  acknowledgeAlarm,
  clearAlarmAcknowledgement,
  useAllAlarmsAcknowledged,
  isAlarmAcknowledged
} from '../../../utils/alarmAcknowledge';

interface AlarmIndicatorProps {
  state: SldComponentState;
  offsetX: number;
  offsetY: number;
}

/** Hexagon polygon points centered at (0,0) with the given circumradius. */
function hexagonPoints(r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${(r * Math.cos(angle)).toFixed(2)},${(r * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(' ');
}

/** Equilateral triangle pointing up, centered at (0,0) with the given circumradius. */
function trianglePoints(r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const angle = ((2 * Math.PI) / 3) * i - Math.PI / 2;
    pts.push(`${(r * Math.cos(angle)).toFixed(2)},${(r * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(' ');
}

/**
 * Severity badge shape — a bold filled shape whose geometry encodes severity:
 *   Emergency → hexagon
 *   Critical  → square
 *   Warning   → triangle
 *   Info      → circle
 * All shapes are sized to a similar visual area so the alarm count stays
 * legible inside.
 */
const SeverityShape: React.FC<{
  severity: AlarmSeverityDto;
  color: string;
  strokeColor: string;
}> = ({ severity, color, strokeColor }) => {
  const common = {
    fill: color,
    stroke: strokeColor,
    strokeWidth: 2,
    strokeLinejoin: 'round' as const,
  };
  switch (severity) {
    case 'Emergency':
      return <polygon points={hexagonPoints(10)} {...common} />;
    case 'Critical':
      return <rect x={-8} y={-8} width={16} height={16} rx={1} {...common} />;
    case 'Warning':
      return <polygon points={trianglePoints(11)} {...common} />;
    case 'Info':
      return <circle cx={0} cy={0} r={8} {...common} />;
  }
};

/**
 * Colored badge overlay that appears on alarmed components. The badge's
 * shape encodes severity (hexagon/square/triangle/circle) and the center
 * shows the active alarm count. Emergency/Critical badges pulse via a halo
 * ring animation. Clicking opens a popover listing the active alarms.
 */
const AlarmIndicator: React.FC<AlarmIndicatorProps> = ({ state, offsetX, offsetY }) => {
  const theme = useTheme();
  const badgeRef = useRef<SVGGElement>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [ackTick, setAckTick] = useState(0);
  const allAcked = useAllAlarmsAcknowledged(state.activeAlarms.map(a => a.alarm_num));

  if (state.activeAlarmCount === 0 || !state.highestSeverity) return null;

  const color = severityColor(state.highestSeverity, theme);
  const strokeColor = theme.palette.getContrastText(color);
  const shouldPulse =
    state.highestSeverity === 'Emergency' || state.highestSeverity === 'Critical';
  const animate = shouldPulse && !allAcked;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPopoverOpen(true);
  };

  const handleAcknowledgeAll = () => {
    for (const alarm of state.activeAlarms) {
      acknowledgeAlarm(alarm.alarm_num, alarm.severity);
    }
    setAckTick(t => t + 1);
  };

  const handleAcknowledgeOne = (alarm: ActiveAlarmSummary) => {
    if (isAlarmAcknowledged(alarm.alarm_num)) {
      clearAlarmAcknowledgement(alarm.alarm_num);
    } else {
      acknowledgeAlarm(alarm.alarm_num, alarm.severity);
    }
    setAckTick(t => t + 1);
  };

  return (
    <g transform={`translate(${offsetX}, ${offsetY})`}>
      {animate && (
        <circle cx={0} cy={0} r={12} fill={color} opacity={0.3}>
          <animate
            attributeName="r"
            values="10;16;10"
            dur="1.5s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.3;0.05;0.3"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      {/* Clickable severity-shaped badge */}
      <g
        ref={badgeRef}
        style={{ cursor: 'pointer' }}
        onClick={handleClick}
      >
        <SeverityShape
          severity={state.highestSeverity}
          color={color}
          strokeColor={strokeColor}
        />
      </g>
      {/* Alarm count */}
      <text
        x={0}
        y={4}
        textAnchor="middle"
        fontSize={SLD_FONT.badge}
        fontFamily="monospace"
        fontWeight="bold"
        fill={strokeColor}
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
            slotProps={{ paper: { sx: { p: 2, maxWidth: 360 } } }}
          >
            <Typography variant="subtitle2" gutterBottom>
              {ZONE_DISPLAY_NAMES[state.zone]}
            </Typography>
            <Typography variant="caption" color="text.secondary" gutterBottom component="div">
              {state.activeAlarmCount} active alarm{state.activeAlarmCount !== 1 ? 's' : ''}
            </Typography>
            <Stack spacing={0.75} sx={{ mt: 1 }}>
              {state.activeAlarms.map((alarm) => {
                // Re-read on every render — cheap; key off ackTick to refresh.
                void ackTick;
                const acked = isAlarmAcknowledged(alarm.alarm_num);
                return (
                  <Box key={alarm.alarm_num}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={formatAlarmName(alarm.name)}
                        color={getSeverityColor(alarm.severity)}
                        size="small"
                        variant={acked ? 'filled' : 'outlined'}
                        sx={{ flex: 1, opacity: acked ? 0.7 : 1 }}
                      />
                      <Button
                        size="small"
                        variant={acked ? 'outlined' : 'text'}
                        onClick={() => handleAcknowledgeOne(alarm)}
                      >
                        {acked ? 'Unack' : 'Ack'}
                      </Button>
                    </Box>
                    {alarm.message && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="div"
                        sx={{ pl: 0.5, mt: 0.25, opacity: acked ? 0.7 : 1 }}
                      >
                        {alarm.message}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Stack>
            {state.activeAlarmCount > 1 && !allAcked && (
              <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                <Button size="small" variant="contained" onClick={handleAcknowledgeAll}>
                  Acknowledge all
                </Button>
              </Box>
            )}
            {allAcked && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 1.5, fontStyle: 'italic' }}
              >
                Flash paused — outline kept so the alarm stays findable.
                The flash resumes automatically after the ack window expires.
              </Typography>
            )}
          </Popover>
        </foreignObject>
      )}
    </g>
  );
};

export default AlarmIndicator;
