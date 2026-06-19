import React, { useRef, useState } from 'react';
import { Box, Button, Chip, Popover, Stack, Typography, useTheme } from '@mui/material';
import { formatAlarmName, getSeverityColor, ZONE_DISPLAY_NAMES } from '../../../utils/alarmHelpers';
import type { AlarmSeverityDto } from '@newtown-energy/types';
import { acknowledgeAlarm } from '../../../utils/alarmApi';
import { errorLog } from '../../../utils/debug';
import type { ActiveAlarmSummary, SldComponentState } from '../types';
import { SLD_FONT } from '../sldTypography';
import { severityColor } from './useStatusColors';
import { useSldAlarmRefetch } from '../SldAlarmRefetchContext';

interface AlarmIndicatorProps {
  state: SldComponentState;
  offsetX: number;
  offsetY: number;
}

/** True for alarms still awaiting acknowledgement (firing now or latched). */
function needsAck(alarm: ActiveAlarmSummary): boolean {
  return alarm.status === 'Active' || alarm.status === 'ReturnedUnacknowledged';
}

/** Format an acknowledgement timestamp for compact display. */
function formatAckTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
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
 *
 * When `returned` is set (every alarm on the component is
 * ReturnedUnacknowledged — no longer firing but latched awaiting ack) the
 * shape renders hollow with a dashed outline so the operator can tell it apart
 * at a glance from a currently-active alarm, which renders solid.
 */
const SeverityShape: React.FC<{
  severity: AlarmSeverityDto;
  color: string;
  strokeColor: string;
  returned: boolean;
}> = ({ severity, color, strokeColor, returned }) => {
  const common = returned
    ? {
        // Hollow + dashed + desaturated: distinctly "returned, needs ack".
        fill: 'none',
        stroke: color,
        strokeWidth: 2,
        strokeDasharray: '3 2',
        strokeLinejoin: 'round' as const,
      }
    : {
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
 * ring animation while at least one alarm is still firing AND unacknowledged.
 * Acknowledging pauses the flash (but keeps the outline) and a component whose
 * alarms have all returned-to-normal-but-unacked renders a hollow/dashed badge
 * so it reads as distinct from a currently-active alarm. Clicking opens a
 * popover listing the alarms with per-alarm acknowledgement.
 */
const AlarmIndicator: React.FC<AlarmIndicatorProps> = ({ state, offsetX, offsetY }) => {
  const theme = useTheme();
  const badgeRef = useRef<SVGGElement>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [acking, setAcking] = useState<number | 'all' | null>(null);
  const refetchAlarms = useSldAlarmRefetch();

  if (state.activeAlarmCount === 0 || !state.highestSeverity) return null;

  const color = severityColor(state.highestSeverity, theme);
  const strokeColor = theme.palette.getContrastText(color);
  const shouldPulse =
    state.highestSeverity === 'Emergency' || state.highestSeverity === 'Critical';
  // Pulse only while at least one alarm is firing now AND unacknowledged.
  const anyActiveUnacked = state.activeAlarms.some((a) => a.status === 'Active');
  const animate = shouldPulse && anyActiveUnacked;
  // Distinct "returned, needs ack" look: every alarm on the component is
  // latched-but-not-firing. A single still-firing alarm reverts to the solid
  // active look so the more urgent state always wins.
  const allReturned =
    state.activeAlarms.length > 0 &&
    state.activeAlarms.every((a) => a.status === 'ReturnedUnacknowledged');
  const unackedCount = state.activeAlarms.filter(needsAck).length;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPopoverOpen(true);
  };

  const runAck = async (alarmNums: number[], marker: number | 'all') => {
    setAcking(marker);
    try {
      for (const num of alarmNums) {
        await acknowledgeAlarm(num);
      }
      // Re-fetch so the new server-authoritative status reflects immediately
      // rather than after the next poll tick.
      await refetchAlarms();
    } catch (err) {
      errorLog('Alarm acknowledge failed:', err);
    } finally {
      setAcking(null);
    }
  };

  const handleAcknowledgeAll = () => {
    void runAck(
      state.activeAlarms.filter(needsAck).map((a) => a.alarm_num),
      'all',
    );
  };

  const handleAcknowledgeOne = (alarm: ActiveAlarmSummary) => {
    void runAck([alarm.alarm_num], alarm.alarm_num);
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
          returned={allReturned}
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
        fill={allReturned ? color : strokeColor}
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
              {state.activeAlarmCount} alarm{state.activeAlarmCount !== 1 ? 's' : ''}
            </Typography>
            <Stack spacing={0.75} sx={{ mt: 1 }}>
              {state.activeAlarms.map((alarm) => {
                const acked = alarm.status === 'AcknowledgedActive';
                const returned = alarm.status === 'ReturnedUnacknowledged';
                const ackTime = formatAckTime(alarm.acknowledgedAt);
                return (
                  <Box key={alarm.alarm_num}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={formatAlarmName(alarm.name)}
                        color={getSeverityColor(alarm.severity)}
                        size="small"
                        // Hollow chip for acked (paused) and for returned. A
                        // dashed border additionally marks the returned blip so
                        // it reads apart from a currently-active alarm.
                        variant={alarm.status === 'Active' ? 'filled' : 'outlined'}
                        sx={{
                          flex: 1,
                          opacity: alarm.status === 'Active' ? 1 : 0.7,
                          ...(returned ? { borderStyle: 'dashed' } : {}),
                        }}
                      />
                      {needsAck(alarm) && (
                        <Button
                          size="small"
                          variant="contained"
                          disabled={acking !== null}
                          onClick={() => handleAcknowledgeOne(alarm)}
                        >
                          Ack
                        </Button>
                      )}
                    </Box>
                    {returned && (
                      <Typography
                        variant="caption"
                        sx={{ pl: 0.5, mt: 0.25, display: 'block', fontStyle: 'italic' }}
                        color="warning.main"
                      >
                        Returned to normal — still needs acknowledgement
                      </Typography>
                    )}
                    {acked && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="div"
                        sx={{ pl: 0.5, mt: 0.25 }}
                      >
                        Acknowledged{alarm.acknowledgedByEmail ? ` by ${alarm.acknowledgedByEmail}` : ''}
                        {ackTime ? ` at ${ackTime}` : ''}
                      </Typography>
                    )}
                    {alarm.message && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="div"
                        sx={{ pl: 0.5, mt: 0.25, opacity: alarm.status === 'Active' ? 1 : 0.7 }}
                      >
                        {alarm.message}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Stack>
            {unackedCount > 1 && (
              <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  variant="contained"
                  disabled={acking !== null}
                  onClick={handleAcknowledgeAll}
                >
                  Acknowledge all
                </Button>
              </Box>
            )}
            {unackedCount === 0 && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 1.5, fontStyle: 'italic' }}
              >
                Flash paused — outline kept so the alarm stays findable while it
                remains active.
              </Typography>
            )}
          </Popover>
        </foreignObject>
      )}
    </g>
  );
};

export default AlarmIndicator;
