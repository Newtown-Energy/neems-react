import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  IconButton,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { NotificationsActive, Refresh } from '@mui/icons-material';
import type { ActiveAlarmsResponse, AlarmDefinitionsResponse, AlarmDefinitionDto, AlarmSeverityDto, AlarmZoneDto } from '@newtown-energy/types';
import { fetchActiveAlarms, fetchAlarmDefinitions } from '../utils/alarmApi';
import {
  ZONE_DISPLAY_NAMES,
  formatAlarmName,
  getSeverityColor,
  getSeverityOrder,
} from '../utils/alarmHelpers';

export const pageConfig = {
  id: 'alarms',
  title: 'Alarms',
  icon: NotificationsActive,
};

const SEVERITY_OPTIONS: AlarmSeverityDto[] = ['Emergency', 'Critical', 'Warning', 'Info'];
const ZONE_OPTIONS: AlarmZoneDto[] = Object.keys(ZONE_DISPLAY_NAMES) as AlarmZoneDto[];

const POLL_INTERVAL_MS = 10_000;
const STALE_THRESHOLD_SECONDS = 60;

/** A row in the alarm table — either active or inactive */
interface AlarmRow {
  alarm_num: number;
  zone: AlarmZoneDto;
  name: string;
  severity: AlarmSeverityDto;
  active: boolean;
}

const AlarmsPage: React.FC = () => {
  const [data, setData] = useState<ActiveAlarmsResponse | null>(null);
  const [definitions, setDefinitions] = useState<AlarmDefinitionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<AlarmSeverityDto[]>([]);
  const [zoneFilter, setZoneFilter] = useState<string>('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadAlarms = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const response = await fetchActiveAlarms();
      setData(response);
      setLastRefresh(new Date());
    } catch (err) {
      setError('Failed to load alarm data');
      console.error('Error loading alarms:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Definitions are static — load once
    fetchAlarmDefinitions()
      .then(setDefinitions)
      .catch((err) => console.error('Error loading alarm definitions:', err));

    loadAlarms(true);
    const interval = setInterval(() => loadAlarms(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadAlarms]);

  // Build unified alarm rows: active alarms first, then inactive definitions
  const allRows: AlarmRow[] = React.useMemo(() => {
    if (!definitions) return [];

    const activeNums = new Set(data?.alarms.map((a) => a.alarm_num) ?? []);

    const rows: AlarmRow[] = definitions.definitions.map((def: AlarmDefinitionDto) => ({
      alarm_num: def.alarm_num,
      zone: def.zone,
      name: def.name,
      severity: def.severity,
      active: activeNums.has(def.alarm_num),
    }));

    // Active first (sorted by severity, then zone, then name),
    // then inactive (sorted by zone, then name)
    rows.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      if (a.active && b.active) {
        const sevDiff = getSeverityOrder(a.severity) - getSeverityOrder(b.severity);
        if (sevDiff !== 0) return sevDiff;
      }
      const zoneCmp = ZONE_DISPLAY_NAMES[a.zone].localeCompare(ZONE_DISPLAY_NAMES[b.zone]);
      if (zoneCmp !== 0) return zoneCmp;
      return a.name.localeCompare(b.name);
    });

    return rows;
  }, [data, definitions]);

  const filteredRows = allRows.filter((a) => {
    if (severityFilter.length > 0 && !severityFilter.includes(a.severity)) return false;
    if (zoneFilter && a.zone !== zoneFilter) return false;
    return true;
  });

  const activeCount = filteredRows.filter((r) => r.active).length;

  const severityCounts: Record<string, number> = {};
  if (data) {
    for (const a of data.alarms) {
      severityCounts[a.severity] = (severityCounts[a.severity] || 0) + 1;
    }
  }

  const isStale =
    data?.data_age_seconds != null && data.data_age_seconds > STALE_THRESHOLD_SECONDS;

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

      {/* Stale data warning */}
      {isStale && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Alarm data is {data!.data_age_seconds} seconds old. The RTAC connection may be down.
        </Alert>
      )}

      {/* Emergency/Critical banner */}
      {data?.has_emergency && (
        <Alert severity="error" sx={{ mb: 2 }}>
          EMERGENCY alarms are active — immediate action required.
        </Alert>
      )}
      {data?.has_critical && !data?.has_emergency && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Critical alarms are active — attention required.
        </Alert>
      )}

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

      {/* Alarm table */}
      <Card>
        <CardContent>
          {filteredRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No alarms match the current filters
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Status</TableCell>
                    <TableCell>Alarm #</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Zone</TableCell>
                    <TableCell>Severity</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRows.map((alarm) => (
                    <TableRow
                      key={alarm.alarm_num}
                      sx={alarm.active ? {} : { opacity: 0.45 }}
                    >
                      <TableCell>
                        <Chip
                          label={alarm.active ? 'Active' : 'OK'}
                          color={alarm.active ? getSeverityColor(alarm.severity) : 'default'}
                          variant={alarm.active ? 'filled' : 'outlined'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{alarm.alarm_num}</TableCell>
                      <TableCell>{formatAlarmName(alarm.name)}</TableCell>
                      <TableCell>{ZONE_DISPLAY_NAMES[alarm.zone]}</TableCell>
                      <TableCell>
                        <Chip
                          label={alarm.severity}
                          color={alarm.active ? getSeverityColor(alarm.severity) : 'default'}
                          variant={alarm.active ? 'filled' : 'outlined'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default AlarmsPage;
