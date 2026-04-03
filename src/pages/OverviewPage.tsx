import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, List, ListItem, ListItemText, ListItemIcon, Chip, Alert, CircularProgress, Button } from '@mui/material';
import { TrendingDown, CheckCircle, Dashboard } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import type { ActiveAlarmsResponse } from '@newtown-energy/types';
import { fetchActiveAlarms } from '../utils/alarmApi';
import { formatAlarmName, getSeverityColor, getSeverityOrder, ZONE_DISPLAY_NAMES } from '../utils/alarmHelpers';

export const pageConfig = {
  id: 'overview',
  title: 'Overview',
  icon: Dashboard
};

const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [alarmData, setAlarmData] = useState<ActiveAlarmsResponse | null>(null);
  const [alarmLoading, setAlarmLoading] = useState(true);
  const [alarmError, setAlarmError] = useState<string | null>(null);

  const loadAlarms = useCallback(async () => {
    try {
      const response = await fetchActiveAlarms();
      setAlarmData(response);
      setAlarmError(null);
    } catch (err) {
      setAlarmError('Failed to load alarm data');
      console.error('Error loading alarms:', err);
    } finally {
      setAlarmLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlarms();
    const interval = setInterval(loadAlarms, 10_000);
    return () => clearInterval(interval);
  }, [loadAlarms]);

  // Top 5 most severe alarms for the summary
  const topAlarms = alarmData
    ? [...alarmData.alarms]
        .sort((a, b) => getSeverityOrder(a.severity) - getSeverityOrder(b.severity))
        .slice(0, 5)
    : [];

  const severityCounts: Record<string, number> = {};
  if (alarmData) {
    for (const a of alarmData.alarms) {
      severityCounts[a.severity] = (severityCounts[a.severity] || 0) + 1;
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h2" gutterBottom>
        Overview
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3, mb: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Monthly flibbers
            </Typography>
            <Typography variant="h4" component="div">
              1,018
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Total Whatchamacallits
            </Typography>
            <Typography variant="h4" component="div">
              5,133
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              TSLA share price
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingDown color="error" />
              <Typography variant="h4" component="div" color="error">
                22.8%
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3 }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h6">
                Active Alarms
              </Typography>
              <Button size="small" onClick={() => navigate('/alarms')}>
                View All
              </Button>
            </Box>

            {alarmLoading && !alarmData && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            )}

            {alarmError && (
              <Alert severity="error" sx={{ mb: 1 }}>
                {alarmError}
              </Alert>
            )}

            {alarmData && (alarmData.has_emergency || alarmData.has_critical) && (
              <Alert severity={alarmData.has_emergency ? 'error' : 'warning'} sx={{ mb: 1 }}>
                {alarmData.has_emergency
                  ? 'EMERGENCY alarms active'
                  : 'Critical alarms active'}
              </Alert>
            )}

            {alarmData && (
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                {(['Emergency', 'Critical', 'Warning', 'Info'] as const).map((severity) => {
                  const count = severityCounts[severity] || 0;
                  if (count === 0) return null;
                  return (
                    <Chip
                      key={severity}
                      label={`${count} ${severity}`}
                      color={getSeverityColor(severity)}
                      size="small"
                    />
                  );
                })}
                {alarmData.alarms.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No active alarms
                  </Typography>
                )}
              </Box>
            )}

            {topAlarms.length > 0 && (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Alarm</TableCell>
                      <TableCell>Zone</TableCell>
                      <TableCell>Severity</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topAlarms.map((alarm) => (
                      <TableRow key={alarm.alarm_num}>
                        <TableCell>{formatAlarmName(alarm.name)}</TableCell>
                        <TableCell>{ZONE_DISPLAY_NAMES[alarm.zone]}</TableCell>
                        <TableCell>
                          <Chip
                            label={alarm.severity}
                            color={getSeverityColor(alarm.severity)}
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
        
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              System Maintenance Checklist
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon>
                  <CheckCircle color="success" />
                </ListItemIcon>
                <ListItemText primary="Upgrades" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircle color="success" />
                </ListItemIcon>
                <ListItemText primary="Patches" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircle color="success" />
                </ListItemIcon>
                <ListItemText primary="Backup" />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default OverviewPage;