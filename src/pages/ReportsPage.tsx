/**
 * Operations Reports page.
 *
 * For each day in the chosen window, shows how many minutes the site
 * spent charging vs discharging vs holding (the demo's "how long we
 * charged for / discharged for" framing). Backed by the new
 * /api/1/Sites/<id>/ChargeDischargeSummary endpoint, which derives
 * these totals from the existing charging_state readings.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { Assessment, Download } from '@mui/icons-material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChargeDischargeBucket } from '@newtown-energy/types';

import { fetchChargeDischargeSummary } from '../utils/reportsApi';
import { useSiteContext } from '../utils/SiteContext';
import { COMMAND_BAR_COLORS } from '../utils/scheduleHelpers';
import { downloadCsv, toCsv } from '../utils/csv';
import { errorLog } from '../utils/debug';

export const pageConfig = {
  id: 'reports',
  title: 'Reports',
  icon: Assessment,
};

function startOfDaysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromDateInput(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDayLabel(day: string): string {
  // Strip the year for a tidier x-axis; full date appears in the tooltip.
  const parts = day.split('-');
  if (parts.length !== 3) return day;
  return `${parts[1]}/${parts[2]}`;
}

function formatMinutes(value: number): string {
  if (value < 60) return `${value.toFixed(0)} min`;
  const h = Math.floor(value / 60);
  const m = Math.round(value - h * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const ReportsPage: React.FC = () => {
  const theme = useTheme();
  const { selectedSite } = useSiteContext();
  const [from, setFrom] = useState<Date>(() => startOfDaysAgo(7));
  const [to, setTo] = useState<Date>(() => new Date());
  const [buckets, setBuckets] = useState<ChargeDischargeBucket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!selectedSite) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchChargeDischargeSummary(selectedSite.id, from, to);
      setBuckets(response.buckets);
    } catch (err) {
      errorLog('ReportsPage: failed to load summary', err);
      setError('Failed to load report data.');
    } finally {
      setLoading(false);
    }
  }, [selectedSite, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    if (!buckets || buckets.length === 0) return null;
    return buckets.reduce(
      (acc, b) => ({
        charging: acc.charging + b.charging_minutes,
        discharging: acc.discharging + b.discharging_minutes,
        hold: acc.hold + b.hold_minutes,
      }),
      { charging: 0, discharging: 0, hold: 0 },
    );
  }, [buckets]);

  const handleExportCsv = () => {
    if (!buckets || !selectedSite) return;
    const headers = ['Day', 'Charging (min)', 'Discharging (min)', 'Hold (min)'];
    const rows = buckets.map(b => [
      b.day,
      b.charging_minutes.toFixed(1),
      b.discharging_minutes.toFixed(1),
      b.hold_minutes.toFixed(1),
    ]);
    downloadCsv(
      `charge-discharge-site-${selectedSite.id}-${toDateInput(from)}_to_${toDateInput(to)}.csv`,
      toCsv(headers, rows),
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h2" gutterBottom>
        Reports
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Time the site actually spent charging, discharging, or holding —
        derived from the RTAC reading log.
      </Typography>

      {!selectedSite && (
        <Alert severity="info">Select a site to see its operations report.</Alert>
      )}

      {selectedSite && (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ '&:last-child': { pb: 2 } }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                <TextField
                  type="date"
                  label="From"
                  size="small"
                  value={toDateInput(from)}
                  onChange={e => {
                    const d = fromDateInput(e.target.value);
                    if (d) setFrom(d);
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  type="date"
                  label="To"
                  size="small"
                  value={toDateInput(to)}
                  onChange={e => {
                    const d = fromDateInput(e.target.value);
                    if (d) setTo(d);
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <Box sx={{ flex: 1 }} />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Download />}
                  onClick={handleExportCsv}
                  disabled={!buckets || buckets.length === 0}
                >
                  Download CSV
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Time per day in each state
              </Typography>
              {loading && buckets === null ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress />
                </Box>
              ) : !buckets || buckets.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No readings in this date range. Try seeding history with{' '}
                  <code>neems-data seed-soc-history --site-id {selectedSite.id}</code>{' '}
                  or widening the window.
                </Typography>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={360}>
                    <BarChart
                      data={buckets}
                      margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="day"
                        tickFormatter={formatDayLabel}
                        stroke={theme.palette.text.secondary}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        tickFormatter={v => `${v}m`}
                        stroke={theme.palette.text.secondary}
                        tick={{ fontSize: 12 }}
                        width={56}
                      />
                      <Tooltip
                        formatter={(value: number, name) => [formatMinutes(value), name]}
                      />
                      <Legend />
                      <Bar
                        dataKey="charging_minutes"
                        name="Charging"
                        stackId="state"
                        fill={COMMAND_BAR_COLORS.charge}
                        isAnimationActive={false}
                      />
                      <Bar
                        dataKey="discharging_minutes"
                        name="Discharging"
                        stackId="state"
                        fill={COMMAND_BAR_COLORS.discharge}
                        isAnimationActive={false}
                      />
                      <Bar
                        dataKey="hold_minutes"
                        name="Hold"
                        stackId="state"
                        fill={theme.palette.grey[400]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>

                  {totals && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Window totals — charging: {formatMinutes(totals.charging)} ·
                        discharging: {formatMinutes(totals.discharging)} ·
                        hold: {formatMinutes(totals.hold)}
                      </Typography>
                    </Box>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
};

export default ReportsPage;
