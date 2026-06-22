import React, { useState, useEffect, useCallback } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Collapse,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Chip,
  Alert,
  IconButton,
  CircularProgress,
  Button,
  Select,
  MenuItem,
  FormControl,
  FormControlLabel,
  InputLabel,
  Switch,
} from '@mui/material';
import {
  NotificationsActive,
  Refresh,
  KeyboardArrowDown,
  KeyboardArrowUp,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import type {
  ActiveAlarmsResponse,
  AlarmDefinitionsResponse,
  AlarmDefinitionDto,
  AlarmHistoryEntry,
  AlarmSeverityDto,
  AlarmStatusDto,
  AlarmZoneDto,
} from '@newtown-energy/types';
import {
  acknowledgeAlarm,
  fetchActiveAlarms,
  fetchAlarmDefinitions,
  fetchAlarmHistory,
} from '../utils/alarmApi';
import {
  ALARM_CATEGORY_ORDER,
  ZONE_DISPLAY_NAMES,
  formatAlarmName,
  getSeverityColor,
  getSeverityOrder,
  getZoneCategory,
  type AlarmCategory,
} from '../utils/alarmHelpers';
import { resolveAlarmSeverity } from '../config/siteConfig';
import { errorLog } from '../utils/debug';

export const pageConfig = {
  id: 'alarms',
  title: 'Alarms',
  icon: NotificationsActive,
};

const SEVERITY_OPTIONS: AlarmSeverityDto[] = ['Emergency', 'Critical', 'Warning', 'Info'];
const ZONE_OPTIONS: AlarmZoneDto[] = Object.keys(ZONE_DISPLAY_NAMES) as AlarmZoneDto[];

const POLL_INTERVAL_MS = 10_000;

/** A row in the alarm table — either active or inactive */
interface AlarmRow {
  alarm_num: number;
  zone: AlarmZoneDto;
  category: AlarmCategory;
  name: string;
  /** Operator-facing message from the alarm spreadsheet; null when none. */
  message: string | null;
  severity: AlarmSeverityDto;
  active: boolean;
  /** Server-authoritative acknowledgement status when the alarm is currently
   *  visible (active or latched); `null` for an inactive definition row. */
  status: AlarmStatusDto | null;
  /** Email of the most recent acknowledger, for display; `null` if unacked. */
  acknowledgedByEmail: string | null;
  /** Number of activations in the last [HISTORY_WINDOW_DAYS] days. */
  activations30d: number;
}

type HistoryState =
  | { kind: 'loading' }
  | { kind: 'loaded'; entries: AlarmHistoryEntry[] }
  | { kind: 'error'; message: string };

const HISTORY_WINDOW_DAYS = 30;

/** Human-readable label for an alarm's acknowledgement status. */
function statusLabel(status: AlarmStatusDto): string {
  switch (status) {
    case 'Active':
      return 'Active';
    case 'AcknowledgedActive':
      return 'Acknowledged';
    case 'ReturnedUnacknowledged':
      return 'Returned — needs ack';
  }
}

type SortKey = 'activations' | 'name' | 'severity' | 'zone';
type SortDir = 'asc' | 'desc';

const AlarmsPage: React.FC = () => {
  const [data, setData] = useState<ActiveAlarmsResponse | null>(null);
  const [definitions, setDefinitions] = useState<AlarmDefinitionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<AlarmSeverityDto[]>([]);
  const [zoneFilter, setZoneFilter] = useState<string>('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [history, setHistory] = useState<Record<number, HistoryState>>({});
  /** Activation counts per alarm over the last [HISTORY_WINDOW_DAYS] days. */
  const [activationCounts, setActivationCounts] = useState<Record<number, number>>({});
  const [groupByCategory, setGroupByCategory] = useState<boolean>(true);
  /** Show only currently-active alarms. On by default — the operator
   *  cares about what's firing now; flip off to browse every definition. */
  const [activeOnly, setActiveOnly] = useState<boolean>(true);
  const [sortKey, setSortKey] = useState<SortKey>('activations');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  /** alarm_num currently being acknowledged (disables its button), or null. */
  const [ackingNum, setAckingNum] = useState<number | null>(null);

  /** Fetch the 30d activation count for every alarm in one call. */
  const loadActivationCounts = useCallback(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - HISTORY_WINDOW_DAYS);
    fetchAlarmHistory(from, to)
      .then((res) => {
        const counts: Record<number, number> = {};
        for (const entry of res.entries) {
          if (entry.active) {
            counts[entry.alarm_num] = (counts[entry.alarm_num] ?? 0) + 1;
          }
        }
        setActivationCounts(counts);
      })
      .catch((err) => errorLog('Failed to load activation counts:', err));
  }, []);

  const loadHistoryFor = useCallback((alarmNum: number) => {
    setHistory((h) => ({ ...h, [alarmNum]: { kind: 'loading' } }));
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - HISTORY_WINDOW_DAYS);
    fetchAlarmHistory(from, to, [alarmNum])
      .then((res) =>
        setHistory((h) => ({ ...h, [alarmNum]: { kind: 'loaded', entries: res.entries } })),
      )
      .catch((err) => {
        errorLog('Alarm history fetch failed:', err);
        setHistory((h) => ({
          ...h,
          [alarmNum]: { kind: 'error', message: 'Failed to load history' },
        }));
      });
  }, []);

  const toggleExpanded = useCallback(
    (alarmNum: number) => {
      const willExpand = !expanded.has(alarmNum);
      if (willExpand && !history[alarmNum]) {
        loadHistoryFor(alarmNum);
      }
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(alarmNum)) next.delete(alarmNum);
        else next.add(alarmNum);
        return next;
      });
    },
    [expanded, history, loadHistoryFor],
  );

  const loadAlarms = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const response = await fetchActiveAlarms();
      setData(response);
      setLastRefresh(new Date());
    } catch (err) {
      setError('Failed to load alarm data');
      errorLog('Error loading alarms:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Acknowledge an alarm, then immediately refresh so its new status shows. */
  const handleAcknowledge = useCallback(
    async (alarmNum: number) => {
      setAckingNum(alarmNum);
      try {
        await acknowledgeAlarm(alarmNum);
        await loadAlarms();
      } catch (err) {
        errorLog('Alarm acknowledge failed:', err);
      } finally {
        setAckingNum(null);
      }
    },
    [loadAlarms],
  );

  useEffect(() => {
    // Definitions are static — load once
    fetchAlarmDefinitions()
      .then(setDefinitions)
      .catch((err) => errorLog('Error loading alarm definitions:', err));

    loadAlarms(true);
    loadActivationCounts();
    const interval = setInterval(() => loadAlarms(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadAlarms, loadActivationCounts]);

  // Build unified alarm rows: active alarms first, then inactive definitions
  const allRows: AlarmRow[] = React.useMemo(() => {
    if (!definitions) return [];

    const activeByNum = new Map((data?.alarms ?? []).map((a) => [a.alarm_num, a]));

    return definitions.definitions.map((def: AlarmDefinitionDto) => {
      const activeAlarm = activeByNum.get(def.alarm_num);
      return {
        alarm_num: def.alarm_num,
        zone: def.zone,
        category: getZoneCategory(def.zone),
        name: def.name,
        message: def.message ?? null,
        severity: resolveAlarmSeverity(def.alarm_num, def.severity),
        active: activeAlarm != null,
        status: activeAlarm?.status ?? null,
        acknowledgedByEmail: activeAlarm?.acknowledged_by_email ?? null,
        activations30d: activationCounts[def.alarm_num] ?? 0,
      };
    });
  }, [data, definitions, activationCounts]);

  const handleSort = (key: SortKey): void => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // First click on a new column: descending for counts (most chronic
      // first), ascending for everything else (alpha or severity).
      setSortDir(key === 'activations' ? 'desc' : 'asc');
    }
  };

  const compareRows = useCallback(
    (a: AlarmRow, b: AlarmRow): number => {
      // Active alarms always above inactive — the operator wants the
      // current state first regardless of sort.
      if (a.active !== b.active) return a.active ? -1 : 1;
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'activations':
          return (a.activations30d - b.activations30d) * dir;
        case 'severity':
          return (getSeverityOrder(a.severity) - getSeverityOrder(b.severity)) * dir;
        case 'zone':
          return ZONE_DISPLAY_NAMES[a.zone].localeCompare(ZONE_DISPLAY_NAMES[b.zone]) * dir;
        case 'name':
          return a.name.localeCompare(b.name) * dir;
      }
    },
    [sortKey, sortDir],
  );

  const filteredRows = allRows
    .filter((a) => {
      if (activeOnly && !a.active) return false;
      if (severityFilter.length > 0 && !severityFilter.includes(a.severity)) return false;
      if (zoneFilter && a.zone !== zoneFilter) return false;
      return true;
    })
    .slice()
    .sort(compareRows);

  const activeCount = filteredRows.filter((r) => r.active).length;

  // Group rows by category for the accordion view. Categories appear in
  // ALARM_CATEGORY_ORDER even when empty? No — drop empty buckets so
  // the layout doesn't sprawl.
  const rowsByCategory = React.useMemo(() => {
    const map = new Map<AlarmCategory, AlarmRow[]>();
    for (const row of filteredRows) {
      const list = map.get(row.category) ?? [];
      list.push(row);
      map.set(row.category, list);
    }
    return ALARM_CATEGORY_ORDER
      .filter((cat) => map.has(cat))
      .map((cat) => ({ category: cat, rows: map.get(cat)! }));
  }, [filteredRows]);

  const severityCounts: Record<string, number> = {};
  if (data) {
    for (const a of data.alarms) {
      const sev = resolveAlarmSeverity(a.alarm_num, a.severity);
      severityCounts[sev] = (severityCounts[sev] || 0) + 1;
    }
  }

  const toggleSeverityFilter = (severity: AlarmSeverityDto) => {
    setSeverityFilter((prev) =>
      prev.includes(severity) ? prev.filter((s) => s !== severity) : [...prev, severity],
    );
  };

  if (loading && !data) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h2">Alarms</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {lastRefresh && (
            <Typography variant="body2" color="text.secondary">
              Updated {lastRefresh.toLocaleTimeString()}
            </Typography>
          )}
          <IconButton onClick={() => loadAlarms()} size="small" title="Refresh">
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Stale-data and emergency/critical banners now render once,
          app-wide, via SiteStatePanel (the global status banner), so they
          appear on every page instead of only here. */}

      {/* Summary chips */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        {SEVERITY_OPTIONS.map((severity) => {
          const count = severityCounts[severity] || 0;
          const isActive = severityFilter.includes(severity);
          return (
            <Chip
              key={severity}
              label={`${count} ${severity}`}
              color={count > 0 ? getSeverityColor(severity) : 'default'}
              variant={isActive ? 'filled' : 'outlined'}
              onClick={() => toggleSeverityFilter(severity)}
              sx={{ fontWeight: isActive ? 'bold' : 'normal' }}
            />
          );
        })}
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center', py: 1, '&:last-child': { pb: 1 } }}>
          <FormControlLabel
            control={
              <Switch
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                size="small"
              />
            }
            label="Active only"
          />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Filter by Zone</InputLabel>
            <Select
              value={zoneFilter}
              label="Filter by Zone"
              onChange={(e) => setZoneFilter(e.target.value)}
            >
              <MenuItem value="">All Zones</MenuItem>
              {ZONE_OPTIONS.map((zone) => (
                <MenuItem key={zone} value={zone}>
                  {ZONE_DISPLAY_NAMES[zone]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Layout</InputLabel>
            <Select
              value={groupByCategory ? 'grouped' : 'flat'}
              label="Layout"
              onChange={(e) => setGroupByCategory(e.target.value === 'grouped')}
            >
              <MenuItem value="grouped">Group by category</MenuItem>
              <MenuItem value="flat">Flat table</MenuItem>
            </Select>
          </FormControl>
          {(severityFilter.length > 0 || zoneFilter) && (
            <Chip
              label="Clear filters"
              size="small"
              onDelete={() => {
                setSeverityFilter([]);
                setZoneFilter('');
              }}
            />
          )}
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
            {activeCount} active of {filteredRows.length} shown
          </Typography>
        </CardContent>
      </Card>

      {/* Alarm table — either grouped by category or flat */}
      {filteredRows.length === 0 ? (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No alarms match the current filters
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : groupByCategory ? (
        <Box>
          {rowsByCategory.map(({ category, rows }) => {
            const activeRows = rows.filter((r) => r.active);
            const activeInCategory = activeRows.length;
            const totalActivations = rows.reduce((s, r) => s + r.activations30d, 0);
            // Color the "N active" chip by the most urgent active alarm in
            // the bucket (lowest severity order = most urgent).
            const mostUrgentActiveSeverity = activeRows.reduce<AlarmSeverityDto | null>(
              (most, r) =>
                most === null || getSeverityOrder(r.severity) < getSeverityOrder(most)
                  ? r.severity
                  : most,
              null,
            );
            return (
              <Accordion key={category} defaultExpanded sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                    <Typography variant="h6" sx={{ flexGrow: 0 }}>
                      {category}
                    </Typography>
                    {activeInCategory > 0 && (
                      <Chip
                        label={`${activeInCategory} active`}
                        color={
                          mostUrgentActiveSeverity
                            ? getSeverityColor(mostUrgentActiveSeverity)
                            : 'error'
                        }
                        size="small"
                      />
                    )}
                    <Typography variant="body2" color="text.secondary">
                      {rows.length} alarm{rows.length === 1 ? '' : 's'} • {totalActivations}{' '}
                      activation{totalActivations === 1 ? '' : 's'} in last {HISTORY_WINDOW_DAYS}d
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  {renderTable(rows)}
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
      ) : (
        <Card>
          <CardContent>{renderTable(filteredRows)}</CardContent>
        </Card>
      )}
    </Box>
  );

  function renderTable(rows: AlarmRow[]): React.ReactElement {
    const sortable = (label: string, key: SortKey): React.ReactElement => (
      <TableSortLabel
        active={sortKey === key}
        direction={sortKey === key ? sortDir : 'asc'}
        onClick={() => handleSort(key)}
      >
        {label}
      </TableSortLabel>
    );

    return (
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 40 }} />
              <TableCell>Status</TableCell>
              <TableCell>Alarm #</TableCell>
              <TableCell>{sortable('Name', 'name')}</TableCell>
              <TableCell>{sortable('Zone', 'zone')}</TableCell>
              <TableCell>{sortable('Severity', 'severity')}</TableCell>
              <TableCell align="right">
                {sortable(`Count (${HISTORY_WINDOW_DAYS}d)`, 'activations')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((alarm) => {
              const isExpanded = expanded.has(alarm.alarm_num);
              const rowHistory = history[alarm.alarm_num];
              return (
                <React.Fragment key={alarm.alarm_num}>
                  <TableRow
                    sx={{
                      ...(alarm.active ? {} : { opacity: 0.45 }),
                      '& > *': { borderBottom: 'unset' },
                    }}
                  >
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => toggleExpanded(alarm.alarm_num)}
                        aria-label={isExpanded ? 'collapse history' : 'expand history'}
                      >
                        {isExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={alarm.status ? statusLabel(alarm.status) : 'OK'}
                          color={alarm.active ? getSeverityColor(alarm.severity) : 'default'}
                          // Solid only while currently firing AND unacked. Acked
                          // and returned-but-unacked alarms render hollow; the
                          // returned blip additionally gets a dashed border so it
                          // reads apart from a currently-active alarm.
                          variant={alarm.status === 'Active' ? 'filled' : 'outlined'}
                          size="small"
                          sx={
                            alarm.status === 'ReturnedUnacknowledged'
                              ? { borderStyle: 'dashed' }
                              : undefined
                          }
                        />
                        {(alarm.status === 'Active' ||
                          alarm.status === 'ReturnedUnacknowledged') && (
                          <Button
                            size="small"
                            variant="contained"
                            disabled={ackingNum === alarm.alarm_num}
                            onClick={() => handleAcknowledge(alarm.alarm_num)}
                          >
                            Ack
                          </Button>
                        )}
                      </Box>
                      {alarm.status === 'AcknowledgedActive' && alarm.acknowledgedByEmail && (
                        <Typography variant="caption" color="text.secondary" component="div">
                          by {alarm.acknowledgedByEmail}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{alarm.alarm_num}</TableCell>
                    <TableCell>
                      {formatAlarmName(alarm.name)}
                      {alarm.message && (
                        <Typography variant="caption" color="text.secondary" component="div">
                          {alarm.message}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{ZONE_DISPLAY_NAMES[alarm.zone]}</TableCell>
                    <TableCell>
                      <Chip
                        label={alarm.severity}
                        color={alarm.active ? getSeverityColor(alarm.severity) : 'default'}
                        variant={alarm.active ? 'filled' : 'outlined'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {alarm.activations30d === 0 ? (
                        <Typography variant="body2" color="text.disabled">
                          0
                        </Typography>
                      ) : (
                        <Chip
                          label={alarm.activations30d}
                          size="small"
                          color={alarm.activations30d >= 10 ? 'warning' : 'default'}
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 0, border: 0 }}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 2, pl: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Last {HISTORY_WINDOW_DAYS} days of transitions
                          </Typography>
                          {rowHistory?.kind === 'loading' && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CircularProgress size={16} />
                              <Typography variant="body2" color="text.secondary">
                                Loading history…
                              </Typography>
                            </Box>
                          )}
                          {rowHistory?.kind === 'error' && (
                            <Alert severity="error">{rowHistory.message}</Alert>
                          )}
                          {rowHistory?.kind === 'loaded' &&
                            (rowHistory.entries.length === 0 ? (
                              <Typography variant="body2" color="text.secondary">
                                No transitions in the last {HISTORY_WINDOW_DAYS} days.
                              </Typography>
                            ) : (
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Time</TableCell>
                                    <TableCell>Transition</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {[...rowHistory.entries]
                                    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                                    .map((entry) => (
                                      <TableRow
                                        key={`${entry.alarm_num}-${entry.timestamp}-${entry.active}`}
                                      >
                                        <TableCell>
                                          {new Date(entry.timestamp).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                          <Chip
                                            label={entry.active ? 'Activated' : 'Cleared'}
                                            color={entry.active ? 'error' : 'default'}
                                            variant={entry.active ? 'filled' : 'outlined'}
                                            size="small"
                                          />
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                            ))}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }
};

export default AlarmsPage;
