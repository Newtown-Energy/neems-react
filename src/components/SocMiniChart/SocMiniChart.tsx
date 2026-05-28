/**
 * SoC mini-chart for the Overview dashboard.
 *
 * Fetches the last 24 hours of state-of-charge readings for the
 * currently-selected site and renders them as a recharts bar chart —
 * each reading is a discrete sample (6-min cadence by default), so
 * bars are a more honest visualization than a line.
 *
 * Empty state when the site has no history yet.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SocHistoryPoint } from '@newtown-energy/types';

import { fetchSocHistory } from '../../utils/socApi';
import { errorLog } from '../../utils/debug';

interface SocMiniChartProps {
  siteId: number;
  /** Window size in hours. Defaults to 24. */
  windowHours?: number;
  /** Chart height in pixels. Defaults to 220. */
  height?: number;
}

interface ChartPoint {
  /** Epoch ms — recharts handles numeric x-axis well. */
  t: number;
  soc: number;
}

function toChartPoints(points: SocHistoryPoint[]): ChartPoint[] {
  return points.map(p => ({
    // `timestamp` from the backend is a naive UTC string, no `Z`
    // suffix. Append one so JS doesn't reinterpret it in local time.
    t: new Date(`${p.timestamp}Z`).getTime(),
    soc: p.soc_percent,
  }));
}

function formatHourLabel(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getHours().toString().padStart(2, '0')}:00`;
}

function formatTooltipLabel(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleString();
}

const SocMiniChart: React.FC<SocMiniChartProps> = ({
  siteId,
  windowHours = 24,
  height = 220,
}) => {
  const theme = useTheme();
  const [points, setPoints] = useState<ChartPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPoints(null);
    setError(null);
    const to = new Date();
    const from = new Date(to.getTime() - windowHours * 60 * 60 * 1000);
    void (async () => {
      try {
        const response = await fetchSocHistory(siteId, from, to);
        if (!cancelled) setPoints(toChartPoints(response.points));
      } catch (err) {
        errorLog('SocMiniChart: failed to load SoC history', err);
        if (!cancelled) setError('Failed to load SoC history');
      }
    })();
    return () => { cancelled = true; };
  }, [siteId, windowHours]);

  const latestSoc = useMemo(() => {
    if (!points || points.length === 0) return null;
    return points[points.length - 1].soc;
  }, [points]);

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }
  if (points === null) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
        <CircularProgress size={28} />
      </Box>
    );
  }
  if (points.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
        <Typography variant="body2" color="text.secondary">
          No SoC history yet for this site.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {latestSoc !== null && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Latest: {latestSoc.toFixed(1)}%
        </Typography>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tickFormatter={formatHourLabel}
            stroke={theme.palette.text.secondary}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={v => `${v}%`}
            stroke={theme.palette.text.secondary}
            tick={{ fontSize: 12 }}
            width={48}
          />
          <Tooltip
            labelFormatter={(label) => formatTooltipLabel(label as number)}
            formatter={(value) => [`${(value as number).toFixed(1)}%`, 'SoC']}
            cursor={{ fill: theme.palette.action.hover }}
          />
          <Bar
            dataKey="soc"
            fill={theme.palette.primary.main}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default SocMiniChart;
