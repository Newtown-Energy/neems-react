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
} from '@newtown-energy/types';
import { fetchActiveAlarms, fetchAlarmDefinitions, fetchAlarmHistory } from '../utils/alarmApi';
import {
  ZONE_DISPLAY_NAMES,
  formatAlarmName,
  getSeverityColor,
} from '../utils/alarmHelpers';
import { resolveAlarmSeverity } from '../config/siteConfig';
import { downloadCsv, toCsv } from '../utils/csv';
import { errorLog } from '../utils/debug';

export const pageConfig = {
  id: 'fdny',
  title: 'FDNY',
  iconPath: '/FDNY.svg',
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

/**
 * FDNY alarm-event timeline. Shows chronological alarm state transitions
 * over a user-chosen date range, optionally filtered by alarm. The most
 * recent transition for each alarm is visually set off and tagged
 * "CURRENT" when it matches the alarm's present active/cleared state.
 */
const FDNYPage: React.FC = () => {
  const [from, setFrom] = useState<Date>(() => startOfDaysAgo(7));
  const [to, setTo] = useState<Date>(() => new Date());
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [history, active] = await Promise.all([
        fetchAlarmHistory(from, to, alarmNumFilter.length > 0 ? alarmNumFilter : undefined),
        fetchActiveAlarms(),
      ]);
      setEntries(history.entries);
      setActiveAlarmNums(new Set(active.alarms.map((a) => a.alarm_num)));
      setLastRefresh(new Date());
    } catch (err) {
      setError('Failed to load alarm history');
      errorLog('Error loading alarm history:', err);
    } finally {
      setLoading(false);
    }
  }, [from, to, alarmNumFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Compute the "current status" row per alarm_num — the chronologically-latest
  // transition wins, and only if its active/cleared value matches today's state.
  const latestByAlarmNum = useMemo(() => {
    const m = new Map<number, AlarmHistoryEntry>();
    for (const e of entries) {
      // Backend returns entries in ascending chronological order, so the last
      // write wins — giving us the most recent transition per alarm.
      m.set(e.alarm_num, e);
    }
    return m;
  }, [entries]);

  const isCurrentRow = useCallback(
    (entry: AlarmHistoryEntry): boolean => {
      if (latestByAlarmNum.get(entry.alarm_num) !== entry) return false;
      const isActiveNow = activeAlarmNums.has(entry.alarm_num);
      return entry.active === isActiveNow;
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
    const headers = ['Time', 'Alarm', 'Zone', 'Severity', 'Transition', 'Status'];
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
        entry.active ? 'Activated' : 'Cleared',
        isCurrentRow(entry) ? 'CURRENT' : '',
      ];
    });
    const csv = toCsv(headers, rows);
    const stamp = (d: Date) => d.toISOString().slice(0, 10);
    downloadCsv(`fdny-alarms-${stamp(from)}_to_${stamp(to)}.csv`, csv);
  }, [sortedEntries, definitionsByNum, isCurrentRow, from, to]);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h2">FDNY</Typography>
          <Typography variant="body2" color="text.secondary">
            Chronological record of alarm state changes. The most recent
            transition for each alarm is highlighted "CURRENT" when it
            reflects today's active/cleared state.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {lastRefresh && (
            <Typography variant="body2" color="text.secondary">
              Updated {lastRefresh.toLocaleTimeString()}
            </Typography>
          )}
          <IconButton onClick={load} size="small" title="Refresh" disabled={loading}>
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
              onChange={(e) => setTo(fromLocalInput(e.target.value))}
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
                {definitions.map((d) => (
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
                      <TableCell>Transition</TableCell>
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
                            <Chip
                              label={entry.active ? 'Activated' : 'Cleared'}
                              color={entry.active ? 'error' : 'default'}
                              variant={entry.active ? 'filled' : 'outlined'}
                              size="small"
                            />
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

export default FDNYPage;
