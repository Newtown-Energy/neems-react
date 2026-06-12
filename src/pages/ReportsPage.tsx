/**
 * Operations Reports page.
 *
 * One chart section:
 * 1. Available state of charge — sliding 24h window anchored to "now",
 *    auto-refreshes every 60s so the right edge tracks the current time.
 *
 * The chart supports PNG, PDF, and CSV export.
 *
 * Below the chart: a "Recent schedule changes" activity feed.
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
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  RecentScheduleActivityEntry,
  SocHistoryPoint,
} from '@newtown-energy/types';

import { fetchRecentScheduleActivity } from '../utils/reportsApi';
import { fetchSocHistory } from '../utils/socApi';
import { useSiteContext } from '../utils/SiteContext';
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

// datetime-local round-trip (local time) for the SoC window.
function toDateTimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDateTimeInput(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// SoC histogram bucketing
//
// Over a wide range, plotting every 6-minute sample is unreadable and slow,
// so we average samples into fixed-width buckets and draw one bar per bucket.
// The bucket width grows with the span so the bar count stays bounded (a week
// collapses to roughly hourly bars, a month to a few hours, etc.).
// ---------------------------------------------------------------------------

// Candidate bucket widths in minutes, smallest first. 6 min matches the
// collector cadence (effectively "raw"); the rest are round wall-clock steps.
const SOC_BUCKET_MINUTES = [6, 15, 30, 60, 180, 360, 720, 1440];
const SOC_TARGET_BARS = 240;

function pickBucketMinutes(spanMs: number): number {
  const spanMin = spanMs / 60_000;
  for (const m of SOC_BUCKET_MINUTES) {
    if (spanMin / m <= SOC_TARGET_BARS) return m;
  }
  return SOC_BUCKET_MINUTES[SOC_BUCKET_MINUTES.length - 1];
}

function bucketLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}-minute`;
  const hours = minutes / 60;
  if (hours < 24) return hours === 1 ? 'hourly' : `${hours}-hour`;
  const days = hours / 24;
  return days === 1 ? 'daily' : `${days}-day`;
}

// Average SoC into epoch-aligned buckets (so hourly buckets land on the hour
// in UTC, matching the axis). Each bucket is plotted at its start.
function bucketSocPoints(points: SocChartPoint[], bucketMs: number): SocChartPoint[] {
  if (bucketMs <= 0 || points.length === 0) return points;
  const agg = new Map<number, { sum: number; count: number }>();
  for (const p of points) {
    const key = Math.floor(p.t / bucketMs) * bucketMs;
    const cur = agg.get(key);
    if (cur) {
      cur.sum += p.soc;
      cur.count += 1;
    } else {
      agg.set(key, { sum: p.soc, count: 1 });
    }
  }
  return [...agg.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, { sum, count }]) => ({ t, soc: sum / count }));
}

// Axis ticks: a round wall-clock step chosen so there are ~10 labels.
const SOC_TICK_MINUTES = [60, 120, 180, 360, 720, 1440, 2880, 10080];
const SOC_TARGET_TICKS = 10;

function pickTickMinutes(spanMs: number): number {
  const spanMin = spanMs / 60_000;
  for (const m of SOC_TICK_MINUTES) {
    if (spanMin / m <= SOC_TARGET_TICKS) return m;
  }
  return SOC_TICK_MINUTES[SOC_TICK_MINUTES.length - 1];
}

function generateTicks(from: number, to: number, stepMs: number): number[] {
  const ticks: number[] = [];
  for (let t = Math.ceil(from / stepMs) * stepMs; t <= to; t += stepMs) ticks.push(t);
  return ticks;
}

// Times on the SoC axis are shown in UTC (see the caption under the chart).
// At a midnight boundary we signal the calendar date instead of "00:00" so a
// 24h window that spans two days makes the day change obvious.
function formatHourLabel(epochMs: number): string {
  const d = new Date(epochMs);
  if (d.getUTCHours() === 0) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  return `${d.getUTCHours().toString().padStart(2, '0')}:00`;
}

function formatTooltipLabel(epochMs: number): string {
  return (
    new Date(epochMs).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }) + ' UTC'
  );
}

// Custom tooltip for the SoC chart: reports the SoC% for a real bucket, or an
// explicit "No data" for a gap bucket (where only the `gap` sentinel is set),
// rather than letting the tooltip snap to the nearest real bar.
function SocChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number | null }>;
  label?: number;
}) {
  if (!active || !payload || payload.length === 0 || label == null) return null;
  const soc = payload.find(p => p.dataKey === 'soc' && p.value != null);
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        px: 1.5,
        py: 1,
        boxShadow: 2,
      }}
    >
      <Typography variant="caption" color="text.secondary" display="block">
        {formatTooltipLabel(label)}
      </Typography>
      {soc ? (
        <Typography variant="body2">SoC: {soc.value!.toFixed(1)}%</Typography>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No data
        </Typography>
      )}
    </Box>
  );
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
  const [socFrom, setSocFrom] = useState<Date>(() => new Date(Date.now() - SOC_WINDOW_HOURS * 3600_000));
  const [socTo, setSocTo] = useState<Date>(() => new Date());
  // When live, the 24h window auto-advances to "now" every refresh tick.
  // Editing From/To pins a custom range and turns this off; "Last 24h"
  // turns it back on.
  const [socLive, setSocLive] = useState(true);
  const socChartRef = useRef<HTMLDivElement | null>(null);

  // -- Recent schedule changes feed --
  const [activity, setActivity] = useState<RecentScheduleActivityEntry[] | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  // -- SoC data loading over the selected [socFrom, socTo] window --
  const loadSoc = useCallback(async () => {
    if (!selectedSite) return;
    setNowMs(Date.now());
    try {
      const response = await fetchSocHistory(selectedSite.id, socFrom, socTo);
      setSocPoints(toSocChartPoints(response.points));
      setSocError(null);
    } catch (err) {
      errorLog('ReportsPage: SoC load failed', err);
      setSocError('Failed to load SoC history.');
    }
  }, [selectedSite, socFrom, socTo]);

  useEffect(() => {
    void loadSoc();
  }, [loadSoc]);

  // While live, slide the 24h window to "now" every tick. Advancing the
  // dates re-triggers loadSoc, so this also drives the periodic refresh.
  useEffect(() => {
    if (!socLive) return;
    const id = setInterval(() => {
      const now = new Date();
      setSocTo(now);
      setSocFrom(new Date(now.getTime() - SOC_WINDOW_HOURS * 3600_000));
    }, SOC_REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [socLive]);

  // -- Recent schedule changes loading --
  const loadActivity = useCallback(async () => {
    if (!selectedSite) return;
    setActivityError(null);
    try {
      const response = await fetchRecentScheduleActivity(selectedSite.id, 25);
      setActivity(response.entries);
    } catch (err) {
      errorLog('ReportsPage: schedule activity load failed', err);
      setActivityError('Failed to load schedule changes.');
    }
  }, [selectedSite]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  // -- Derived --
  const socDomain: [number, number] = useMemo(
    () => [socFrom.getTime(), socTo.getTime()],
    [socFrom, socTo],
  );
  const socSpanMs = socDomain[1] - socDomain[0];

  // Bucket width grows with the span so a wide range averages into coarser
  // bars (e.g. ~hourly over a week) instead of plotting every raw sample.
  const bucketMs = useMemo(() => pickBucketMinutes(socSpanMs) * 60_000, [socSpanMs]);
  const bucketedSocPoints = useMemo(
    () => (socPoints ? bucketSocPoints(socPoints, bucketMs) : socPoints),
    [socPoints, bucketMs],
  );

  // Continuous, gapless bucket series across the whole window. Each bucket
  // fills the full height so the chart reads as a solid strip:
  //   - a bucket WITH data draws `soc` (blue) from 0 and `rest` (white) on top,
  //   - a bucket with NO data draws `gap` (gray) full-height.
  // `soc`/`rest` are null in gaps and `gap` is null where there's data, so
  // exactly one of the two stacks renders per bucket. The gray gap bar also
  // gives every missing bucket a hover target so the tooltip can report
  // "No data" instead of snapping to the nearest real bar.
  const socChartData = useMemo(() => {
    if (!bucketedSocPoints) return [];
    const present = new Map(
      bucketedSocPoints.map(p => [Math.floor(p.t / bucketMs) * bucketMs, p.soc]),
    );
    const first = Math.ceil(socDomain[0] / bucketMs) * bucketMs;
    const out: Array<{
      t: number;
      soc: number | null;
      rest: number | null;
      gap: number | null;
    }> = [];
    for (let t = first; t <= socDomain[1]; t += bucketMs) {
      const v = present.get(t);
      out.push({
        t,
        soc: v ?? null,
        rest: v == null ? null : 100 - v,
        gap: v == null ? 100 : null,
      });
    }
    return out;
  }, [bucketedSocPoints, socDomain, bucketMs]);

  // Axis ticks on round wall-clock steps sized to the span (~10 labels).
  const socTicks = useMemo(
    () => generateTicks(socDomain[0], socDomain[1], pickTickMinutes(socSpanMs) * 60_000),
    [socDomain, socSpanMs],
  );

  // Only draw the "Now" marker when the window actually includes now.
  const showNow = nowMs >= socDomain[0] && nowMs <= socDomain[1];

  const latestSoc = useMemo(() => {
    if (!socPoints || socPoints.length === 0) return null;
    return socPoints[socPoints.length - 1].soc;
  }, [socPoints]);

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
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems={{ xs: 'stretch', md: 'center' }}
                sx={{ mb: 1 }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6">Available state of charge</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {latestSoc !== null && `Latest: ${latestSoc.toFixed(1)}% · `}
                    {bucketLabel(bucketMs / 60_000)} averages
                    {socLive && ` · live, updates every ${SOC_REFRESH_INTERVAL_MS / 1000}s`}
                  </Typography>
                </Box>
                <TextField
                  type="datetime-local"
                  label="From"
                  size="small"
                  value={toDateTimeInput(socFrom)}
                  onChange={e => {
                    const d = fromDateTimeInput(e.target.value);
                    if (d) {
                      setSocLive(false);
                      setSocFrom(d);
                    }
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  type="datetime-local"
                  label="To"
                  size="small"
                  value={toDateTimeInput(socTo)}
                  onChange={e => {
                    const d = fromDateTimeInput(e.target.value);
                    if (d) {
                      setSocLive(false);
                      setSocTo(d);
                    }
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <Button
                  size="small"
                  variant={socLive ? 'contained' : 'outlined'}
                  onClick={() => {
                    const now = new Date();
                    setSocTo(now);
                    setSocFrom(new Date(now.getTime() - SOC_WINDOW_HOURS * 3600_000));
                    setSocLive(true);
                  }}
                >
                  Last 24h
                </Button>
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
                  No SoC readings in this range. Seed history with{' '}
                  <code>neems-data seed-soc-history --site-id {selectedSite.id}</code>{' '}
                  or widen the window.
                </Typography>
              ) : (
                <Box ref={socChartRef}>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={socChartData} barCategoryGap={0} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={socDomain}
                        scale="time"
                        ticks={socTicks}
                        tickFormatter={formatHourLabel}
                        stroke={theme.palette.text.secondary}
                        tick={{ fontSize: 12 }}
                        minTickGap={16}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickFormatter={v => `${v}%`}
                        stroke={theme.palette.text.secondary}
                        tick={{ fontSize: 12 }}
                        width={48}
                      />
                      <Tooltip
                        content={<SocChartTooltip />}
                        cursor={{ fill: theme.palette.action.hover }}
                        isAnimationActive={false}
                      />
                      {showNow && (
                        <ReferenceLine
                          x={nowMs}
                          stroke={theme.palette.error.main}
                          strokeDasharray="4 4"
                          label={{ value: 'Now', position: 'top', fill: theme.palette.error.main, fontSize: 11 }}
                        />
                      )}
                      {/* One full-height stack per bucket (shared stackId, no
                          category gap → a continuous strip). A data bucket
                          shows `soc` (blue) under `rest` (white); a no-data
                          bucket shows `gap` (gray) and doubles as the hover
                          target so the tooltip can report "No data". */}
                      <Bar dataKey="gap" stackId="soc" fill={theme.palette.grey[300]} isAnimationActive={false} />
                      <Bar
                        dataKey="soc"
                        stackId="soc"
                        fill={theme.palette.primary.main}
                        isAnimationActive={false}
                      />
                      <Bar
                        dataKey="rest"
                        stackId="soc"
                        fill={theme.palette.common.white}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}
                  >
                    Times shown in UTC
                  </Typography>
                </Box>
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
              {activityError ? (
                <Alert severity="error">{activityError}</Alert>
              ) : activity === null ? (
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
