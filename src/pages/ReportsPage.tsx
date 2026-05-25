/**
 * Operations Reports page.
 *
 * Two chart sections:
 * 1. Available state of charge — sliding 24h window anchored to "now",
 *    auto-refreshes every 60s so the right edge tracks the current time.
 * 2. Charge / discharge / hold time per day — stacked bar for a
 *    user-chosen date range.
 *
 * Both charts support PNG, PDF, and CSV export.
 *
 * Below the charts: a "Recent schedule changes" activity feed.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { Assessment, Download, Image, PictureAsPdf } from '@mui/icons-material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  ChargeDischargeBucket,
  RecentScheduleActivityEntry,
  SocHistoryPoint,
} from '@newtown-energy/types';

import {
  fetchChargeDischargeSummary,
  fetchRecentScheduleActivity,
} from '../utils/reportsApi';
import { fetchSocHistory } from '../utils/socApi';
import { useSiteContext } from '../utils/SiteContext';
import { COMMAND_BAR_COLORS } from '../utils/scheduleHelpers';
import { downloadCsv, toCsv } from '../utils/csv';
import { exportChartPng, exportChartPdf } from '../utils/chartExport';
import { errorLog } from '../utils/debug';

export const pageConfig = {
  id: 'reports',
  title: 'Reports',
  icon: Assessment,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function formatHourLabel(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatTooltipLabel(epochMs: number): string {
  return new Date(epochMs).toLocaleString();
}

// ---------------------------------------------------------------------------
// SoC chart types
// ---------------------------------------------------------------------------

interface SocChartPoint {
  t: number;
  soc: number;
}

function toSocChartPoints(points: SocHistoryPoint[]): SocChartPoint[] {
  return points.map(p => ({
    t: new Date(`${p.timestamp}Z`).getTime(),
    soc: p.soc_percent,
  }));
}

// ---------------------------------------------------------------------------
// Chart export button group
// ---------------------------------------------------------------------------

interface ChartExportProps {
  chartRef: React.RefObject<HTMLDivElement | null>;
  filePrefix: string;
  pdfTitle: string;
  onCsvExport: () => void;
  disabled?: boolean;
}

const ChartExportButtons: React.FC<ChartExportProps> = ({
  chartRef,
  filePrefix,
  pdfTitle,
  onCsvExport,
  disabled,
}) => {
  const [busy, setBusy] = useState(false);
  const handlePng = async () => {
    if (!chartRef.current) return;
    setBusy(true);
    try { await exportChartPng(chartRef.current, `${filePrefix}.png`); }
    catch (err) { errorLog('PNG export failed', err); }
    finally { setBusy(false); }
  };
  const handlePdf = async () => {
    if (!chartRef.current) return;
    setBusy(true);
    try { await exportChartPdf(chartRef.current, `${filePrefix}.pdf`, pdfTitle); }
    catch (err) { errorLog('PDF export failed', err); }
    finally { setBusy(false); }
  };
  return (
    <ButtonGroup size="small" variant="outlined" disabled={disabled || busy}>
      <Button startIcon={<Image />} onClick={handlePng}>PNG</Button>
      <Button startIcon={<PictureAsPdf />} onClick={handlePdf}>PDF</Button>
      <Button startIcon={<Download />} onClick={onCsvExport}>CSV</Button>
    </ButtonGroup>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const SOC_WINDOW_HOURS = 24;
const SOC_REFRESH_INTERVAL_MS = 60_000;

const ReportsPage: React.FC = () => {
  const theme = useTheme();
  const { selectedSite } = useSiteContext();

  // -- SoC chart state --
  const [socPoints, setSocPoints] = useState<SocChartPoint[] | null>(null);
  const [socError, setSocError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const socChartRef = useRef<HTMLDivElement | null>(null);

  // -- Charge/discharge chart state --
  const [from, setFrom] = useState<Date>(() => startOfDaysAgo(7));
  const [to, setTo] = useState<Date>(() => new Date());
  const [buckets, setBuckets] = useState<ChargeDischargeBucket[] | null>(null);
  const [activity, setActivity] = useState<RecentScheduleActivityEntry[] | null>(null);
  const [cdError, setCdError] = useState<string | null>(null);
  const [cdLoading, setCdLoading] = useState(false);
  const cdChartRef = useRef<HTMLDivElement | null>(null);

  // -- SoC data loading with auto-refresh --
  const loadSoc = useCallback(async () => {
    if (!selectedSite) return;
    const now = new Date();
    setNowMs(now.getTime());
    const windowFrom = new Date(now.getTime() - SOC_WINDOW_HOURS * 3600_000);
    try {
      const response = await fetchSocHistory(selectedSite.id, windowFrom, now);
      setSocPoints(toSocChartPoints(response.points));
      setSocError(null);
    } catch (err) {
      errorLog('ReportsPage: SoC load failed', err);
      setSocError('Failed to load SoC history.');
    }
  }, [selectedSite]);

  useEffect(() => {
    void loadSoc();
    const interval = setInterval(() => void loadSoc(), SOC_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadSoc]);

  // -- Charge/discharge data loading --
  const loadCd = useCallback(async () => {
    if (!selectedSite) return;
    setCdLoading(true);
    setCdError(null);
    try {
      const [summary, activityResponse] = await Promise.all([
        fetchChargeDischargeSummary(selectedSite.id, from, to),
        fetchRecentScheduleActivity(selectedSite.id, 25),
      ]);
      setBuckets(summary.buckets);
      setActivity(activityResponse.entries);
    } catch (err) {
      errorLog('ReportsPage: charge/discharge load failed', err);
      setCdError('Failed to load report data.');
    } finally {
      setCdLoading(false);
    }
  }, [selectedSite, from, to]);

  useEffect(() => {
    void loadCd();
  }, [loadCd]);

  // -- Derived --
  const socDomain: [number, number] = useMemo(
    () => [nowMs - SOC_WINDOW_HOURS * 3600_000, nowMs],
    [nowMs],
  );

  const latestSoc = useMemo(() => {
    if (!socPoints || socPoints.length === 0) return null;
    return socPoints[socPoints.length - 1].soc;
  }, [socPoints]);

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

  // -- CSV exports --
  const handleSocCsv = () => {
    if (!socPoints || !selectedSite) return;
    const headers = ['Timestamp', 'SoC (%)'];
    const rows = socPoints.map(p => [
      new Date(p.t).toISOString(),
      p.soc.toFixed(1),
    ]);
    downloadCsv(
      `soc-site-${selectedSite.id}-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(headers, rows),
    );
  };

  const handleCdCsv = () => {
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
    <Box sx={{ p: 3, overflowY: 'auto', height: '100%' }}>
      <Typography variant="h2" gutterBottom>
        Reports
      </Typography>

      {!selectedSite && (
        <Alert severity="info">Select a site to see its operations report.</Alert>
      )}

      {selectedSite && (
        <>
          {/* ---- SoC chart ---- */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Box>
                  <Typography variant="h6">
                    Available state of charge — last {SOC_WINDOW_HOURS} hours
                  </Typography>
                  {latestSoc !== null && (
                    <Typography variant="body2" color="text.secondary">
                      Latest: {latestSoc.toFixed(1)}% · updates every {SOC_REFRESH_INTERVAL_MS / 1000}s
                    </Typography>
                  )}
                </Box>
                <ChartExportButtons
                  chartRef={socChartRef}
                  filePrefix={`soc-site-${selectedSite.id}`}
                  pdfTitle={`Available State of Charge — ${selectedSite.name}`}
                  onCsvExport={handleSocCsv}
                  disabled={!socPoints || socPoints.length === 0}
                />
              </Stack>

              {socError && <Alert severity="error" sx={{ mb: 1 }}>{socError}</Alert>}

              {socPoints === null ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress />
                </Box>
              ) : socPoints.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No SoC readings in the last {SOC_WINDOW_HOURS} hours. Seed history with{' '}
                  <code>neems-data seed-soc-history --site-id {selectedSite.id}</code>.
                </Typography>
              ) : (
                <Box ref={socChartRef}>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={socPoints} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={socDomain}
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
                        labelFormatter={formatTooltipLabel}
                        formatter={(value: number) => [`${value.toFixed(1)}%`, 'SoC']}
                        cursor={{ fill: theme.palette.action.hover }}
                      />
                      <ReferenceLine
                        x={nowMs}
                        stroke={theme.palette.error.main}
                        strokeDasharray="4 4"
                        label={{ value: 'Now', position: 'top', fill: theme.palette.error.main, fontSize: 11 }}
                      />
                      <Bar
                        dataKey="soc"
                        fill={theme.palette.primary.main}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* ---- Charge / discharge chart ---- */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ flex: 1 }}>
                  Time per day in each state
                </Typography>
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
                <ChartExportButtons
                  chartRef={cdChartRef}
                  filePrefix={`charge-discharge-site-${selectedSite.id}`}
                  pdfTitle={`Charge/Discharge Summary — ${selectedSite.name}`}
                  onCsvExport={handleCdCsv}
                  disabled={!buckets || buckets.length === 0}
                />
              </Stack>

              {cdError && <Alert severity="error" sx={{ mb: 1 }}>{cdError}</Alert>}

              {cdLoading && buckets === null ? (
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
                  <Box ref={cdChartRef}>
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
                  </Box>

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

          {/* ---- Recent schedule changes ---- */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent schedule changes
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Merged feed of library-item edits and application-rule changes for
                this site, newest first.
              </Typography>
              {activity === null ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : activity.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No recorded schedule changes for this site.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {activity.map(row => {
                    const isTemplate = row.table_name === 'schedule_templates';
                    const verb = row.operation_type === 'create'
                      ? (isTemplate ? 'Created' : 'Applied')
                      : row.operation_type === 'update'
                        ? (isTemplate ? 'Edited commands' : 'Updated')
                        : row.operation_type === 'delete'
                          ? 'Removed'
                          : row.operation_type;
                    const actor = row.user_email
                      ?? (row.user_id !== null ? `user #${row.user_id}` : 'system');
                    return (
                      <ListItem key={`${row.table_name}-${row.id}`} disableGutters sx={{ py: 0.5 }}>
                        <ListItemText
                          primary={`${row.library_item_name} — ${verb} by ${actor}`}
                          secondary={
                            <>
                              {new Date(row.timestamp).toLocaleString()}
                              {row.change_reason && (
                                <Box
                                  component="span"
                                  sx={{ display: 'block', mt: 0.25, fontStyle: 'italic' }}
                                >
                                  Reason: {row.change_reason}
                                </Box>
                              )}
                            </>
                          }
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption', component: 'div' }}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
};

export default ReportsPage;
