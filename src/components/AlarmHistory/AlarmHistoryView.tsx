import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Download, Refresh } from '@mui/icons-material';
import type {
  AlarmDefinitionDto,
  AlarmHistoryEntry,
  AlarmHistoryEventDto,
} from '@newtown-energy/types';
import { fetchActiveAlarms, fetchAlarmDefinitions, fetchAlarmHistory } from '../../utils/alarmApi';
import {
  ZONE_DISPLAY_NAMES,
  formatAlarmName,
  getSeverityColor,
} from '../../utils/alarmHelpers';
import { resolveAlarmSeverity } from '../../config/siteConfig';
import { downloadCsv, toCsv } from '../../utils/csv';
import { errorLog } from '../../utils/debug';
import { effectiveAlarmNums } from './alarmHistoryFilter';

/** Operator-facing label per event kind.
 *
 *  Switch on `entry.event`, never on the legacy `entry.active` boolean:
 *  acknowledgements report `active: false`, so the old two-state view
 *  labelled every ack as "Cleared" — telling a fire department the alarm
 *  returned to normal when a human had merely said they'd seen it. */
const EVENT_LABEL: Record<AlarmHistoryEventDto, string> = {
  Activated: 'Activated',
  Cleared: 'Cleared',
  Acknowledged: 'Acknowledged',
};

const EVENT_COLOR: Record<AlarmHistoryEventDto, string> = {
  Activated: 'error.main',
  Cleared: 'text.secondary',
  Acknowledged: 'info.main',
};

function startOfDaysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(s: string): Date {
  return new Date(s);
}

export interface AlarmHistoryViewProps {
  /** Page heading. */
  title: string;
  /** One-paragraph explanation under the heading. */
  description: string;
  /** Restrict the page to these alarms — both the query and the filter
   *  dropdown. Omit to cover every alarm. */
  restrictToAlarmNums?: readonly number[];
  /** Leading component of the exported CSV filename. */
  csvFilePrefix: string;
}

/**
 * Alarm-event timeline. Shows chronological alarm state transitions over a
 * user-chosen date range, optionally filtered by alarm. The most recent
 * transition for each alarm is visually set off and tagged "CURRENT" when it
 * matches the alarm's present active/cleared state.
 *
 * Shared by the general Alarm History page and by FDNY, which is this same
 * view restricted to the fire-related alarms.
 */
const AlarmHistoryView: React.FC<AlarmHistoryViewProps> = ({
  title,
  description,
  restrictToAlarmNums,
  csvFilePrefix,
}) => {
  const [from, setFrom] = useState<Date>(() => startOfDaysAgo(7));
  const [to, setTo] = useState<Date>(() => new Date());
  /** True once the operator picks an explicit end date.
   *
   *  Until then `to` means "now" and Refresh advances it. Without this the
   *  bound stays frozen at mount, so nothing that happens while the page is
   *  open can ever enter the range — refreshing looks like it works (the
   *  "Updated" time ticks) while silently querying a stale window. */
  const [toPinned, setToPinned] = useState(false);
  const [alarmNumFilter, setAlarmNumFilter] = useState<number[]>([]);
  const [definitions, setDefinitions] = useState<AlarmDefinitionDto[]>([]);
  const [entries, setEntries] = useState<AlarmHistoryEntry[]>([]);
  const [activeAlarmNums, setActiveAlarmNums] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    fetchAlarmDefinitions()
      .then((d) => setDefinitions(d.definitions))
      .catch((err) => errorLog('Error loading alarm definitions:', err));
  }, []);

  /** The alarms this page offers in its filter dropdown. On a restricted page
   *  the operator narrows within the subject, never back out of it. */
  const selectableDefinitions = useMemo(() => {
    if (!restrictToAlarmNums) return definitions;
    const allowed = new Set(restrictToAlarmNums);
    return definitions.filter((d) => allowed.has(d.alarm_num));
  }, [definitions, restrictToAlarmNums]);

  const queryAlarmNums = useMemo(
    () => effectiveAlarmNums(restrictToAlarmNums, alarmNumFilter),
    [restrictToAlarmNums, alarmNumFilter],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // An empty list means the selection lies entirely outside this page's
      // subject: no rows can match, and asking would fetch everything.
      const historyPromise =
        queryAlarmNums && queryAlarmNums.length === 0
          ? Promise.resolve({ entries: [] })
          : fetchAlarmHistory(from, to, queryAlarmNums);
      const [history, active] = await Promise.all([historyPromise, fetchActiveAlarms()]);
      setEntries(history.entries);
      // Only alarms whose condition is physically present. `/Alarms/Active`
      // also returns latched ones (`data_active: false`, still unacknowledged)
      // that are visible but no longer firing — counting those as "active now"
      // made a cleared alarm's latest transition disagree with present state,
      // costing it the CURRENT tag.
      setActiveAlarmNums(
        new Set(active.alarms.filter((a) => a.data_active).map((a) => a.alarm_num)),
      );
      setLastRefresh(new Date());
    } catch (err) {
      setError('Failed to load alarm history');
      errorLog('Error loading alarm history:', err);
    } finally {
      setLoading(false);
    }
  }, [from, to, queryAlarmNums]);

  useEffect(() => {
    load();
  }, [load]);

  /** Refresh. With `to` still meaning "now", advance it so anything that
   *  happened since the page opened comes into range; the state change
   *  re-triggers `load`. With an explicit end date, just re-run the query. */
  const handleRefresh = useCallback(() => {
    if (toPinned) {
      void load();
    } else {
      setTo(new Date());
    }
  }, [toPinned, load]);

  // Compute the "current status" row per alarm_num — the chronologically-latest
  // transition wins, and only if its active/cleared value matches today's state.
  //
  // Only data-state transitions are eligible. An acknowledgement says nothing
  // about whether the condition is still present, so letting one win here would
  // tag it CURRENT on the strength of its `active: false` placeholder.
  const latestByAlarmNum = useMemo(() => {
    const m = new Map<number, AlarmHistoryEntry>();
    for (const e of entries) {
      if (e.event === 'Acknowledged') continue;
      // Backend returns entries in ascending chronological order, so the last
      // write wins — giving us the most recent transition per alarm.
      m.set(e.alarm_num, e);
    }
    return m;
  }, [entries]);

  /** True for the row describing an alarm's present data state.
   *
   *  That is the newest Activated/Cleared entry for the alarm — acknowledgements
   *  say nothing about whether the condition is present — and only when it
   *  agrees with what the alarm is doing right now. The agreement check matters
   *  when the range ends in the past: the newest transition inside a window
   *  that closed last week is history, not current state. */
  const isCurrentRow = useCallback(
    (entry: AlarmHistoryEntry): boolean => {
      if (latestByAlarmNum.get(entry.alarm_num) !== entry) return false;
      const isActiveNow = activeAlarmNums.has(entry.alarm_num);
      return (entry.event === 'Activated') === isActiveNow;
    },
    [latestByAlarmNum, activeAlarmNums],
  );

  const sortedEntries = useMemo(() => {
    // Show newest first for readability.
    return [...entries].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [entries]);

  const definitionsByNum = useMemo(() => {
    const m = new Map<number, AlarmDefinitionDto>();
    for (const d of definitions) m.set(d.alarm_num, d);
    return m;
  }, [definitions]);

  const handleExportCsv = useCallback(() => {
    const headers = [
      'Time',
      'Alarm',
      'Zone',
      'Severity',
      'Event',
      'Acknowledged by',
      'Note',
      'Status',
    ];
    const rows = sortedEntries.map((entry) => {
      const def = definitionsByNum.get(entry.alarm_num);
      const severity = resolveAlarmSeverity(
        entry.alarm_num,
        def?.severity ?? entry.severity,
      );
      return [
        new Date(entry.timestamp).toISOString(),
        formatAlarmName(entry.name),
        ZONE_DISPLAY_NAMES[entry.zone],
        severity,
        EVENT_LABEL[entry.event],
        entry.acknowledged_by_email ?? '',
        entry.note ?? '',
        isCurrentRow(entry) ? 'CURRENT' : '',
      ];
    });
    const csv = toCsv(headers, rows);
    const stamp = (d: Date) => d.toISOString().slice(0, 10);
    downloadCsv(`${csvFilePrefix}-${stamp(from)}_to_${stamp(to)}.csv`, csv);
  }, [sortedEntries, definitionsByNum, isCurrentRow, from, to, csvFilePrefix]);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h2">{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {lastRefresh && (
            <Typography variant="body2" color="text.secondary">
              Updated {lastRefresh.toLocaleTimeString()}
            </Typography>
          )}
          <IconButton onClick={handleRefresh} size="small" title="Refresh" disabled={loading}>
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ '&:last-child': { pb: 2 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
            <TextField
              type="datetime-local"
              label="From"
              size="small"
              value={toLocalInput(from)}
              onChange={(e) => setFrom(fromLocalInput(e.target.value))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              type="datetime-local"
              label="To"
              size="small"
              value={toLocalInput(to)}
              onChange={(e) => {
                setTo(fromLocalInput(e.target.value));
                setToPinned(true);
              }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <FormControl size="small" sx={{ minWidth: 240, flex: 1 }}>
              <InputLabel>Filter alarms</InputLabel>
              <Select
                multiple
                value={alarmNumFilter}
                onChange={(e) => setAlarmNumFilter(e.target.value as number[])}
                input={<OutlinedInput label="Filter alarms" />}
                renderValue={(selected) =>
                  selected.length === 0
                    ? 'All alarms'
                    : `${selected.length} selected`
                }
              >
                {selectableDefinitions.map((d) => (
                  <MenuItem key={d.alarm_num} value={d.alarm_num}>
                    {formatAlarmName(d.name)}
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 1 }}
                    >
                      {ZONE_DISPLAY_NAMES[d.zone]}
                    </Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {alarmNumFilter.length > 0 && (
              <Chip label="Clear filter" size="small" onDelete={() => setAlarmNumFilter([])} />
            )}
            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
              {sortedEntries.length} transition{sortedEntries.length === 1 ? '' : 's'}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Download />}
              onClick={handleExportCsv}
              disabled={sortedEntries.length === 0}
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

      {loading && entries.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Card>
          <CardContent>
            {sortedEntries.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  No alarm transitions in this range.
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Time</TableCell>
                      <TableCell>Alarm</TableCell>
                      <TableCell>Zone</TableCell>
                      <TableCell>Severity</TableCell>
                      <TableCell>Event</TableCell>
                      <TableCell>Acknowledged by</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedEntries.map((entry) => {
                      const current = isCurrentRow(entry);
                      const def = definitionsByNum.get(entry.alarm_num);
                      const severity = resolveAlarmSeverity(
                        entry.alarm_num,
                        def?.severity ?? entry.severity,
                      );
                      return (
                        <TableRow
                          key={`${entry.alarm_num}-${entry.timestamp}-${entry.active}`}
                          sx={current ? { bgcolor: 'action.selected' } : undefined}
                        >
                          <TableCell>{new Date(entry.timestamp).toLocaleString()}</TableCell>
                          <TableCell>{formatAlarmName(entry.name)}</TableCell>
                          <TableCell>{ZONE_DISPLAY_NAMES[entry.zone]}</TableCell>
                          <TableCell>
                            <Chip
                              label={severity}
                              color={getSeverityColor(severity)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              color={EVENT_COLOR[entry.event]}
                              sx={{ fontWeight: entry.event === 'Activated' ? 600 : 400 }}
                            >
                              {EVENT_LABEL[entry.event]}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {entry.event === 'Acknowledged' && (
                              <Typography variant="body2" color="text.secondary">
                                {entry.acknowledged_by_email ?? '—'}
                                {entry.note ? ` — ${entry.note}` : ''}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {current && (
                              <Chip
                                label="CURRENT"
                                color="primary"
                                size="small"
                                sx={{ fontWeight: 'bold' }}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default AlarmHistoryView;
