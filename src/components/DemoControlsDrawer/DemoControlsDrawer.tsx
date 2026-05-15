/**
 * Demo Controls Drawer.
 *
 * Floating bottom-right launcher that opens a right-edge drawer of
 * live state knobs used during a demo: forced wall-clock, utility
 * curtailment ceiling, current SoC, open breakers, offline Megapacks,
 * and forced alarms. Tab-local values flow through the demo overrides
 * context; forced alarms are pushed to the backend so they surface
 * uniformly on the SLD, alarms page, and FDNY view.
 *
 * Mounted once at the App level. Self-gates to admin-flavored roles
 * so the "force breaker B-1 open" affordance doesn't surface to
 * view-only users — non-admins simply see no button.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  BugReport as DemoIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import type { AlarmDefinitionDto } from '@newtown-energy/types';

import { useDemoOverrides } from '../../utils/demoOverrides';
import { useAuth } from '../../pages/LoginPage/useAuth';
import {
  fetchAlarmDefinitions,
  fetchForcedAlarms,
  setForcedAlarms as putForcedAlarms,
} from '../../utils/alarmApi';
import { getSeverityColor } from '../../utils/alarmHelpers';
import { errorLog } from '../../utils/debug';

const ADMIN_ROLES = ['admin', 'newtown-admin', 'newtown-staff'];

interface DemoControlsDrawerProps {
  /** Names of breakers the operator can flip during the demo. The
   *  drawer doesn't know the SLD's wiring; the host page passes in
   *  whichever breakers the current site exposes. */
  breakerNames?: string[];
  /** Names of Megapacks the operator can flip offline. */
  megapackNames?: string[];
}

/** Default breaker / Megapack lists, used when the host page doesn't
 *  override them — keeps the drawer useful on pages that don't know
 *  the SLD topology yet. */
const DEFAULT_BREAKERS = ['B-1', 'B-2', 'B-3', 'B-4'];
const DEFAULT_MEGAPACKS = ['Megapack-A', 'Megapack-B'];

function datetimeLocalToISO(value: string): string | null {
  if (!value) return null;
  // <input type="datetime-local"> emits "YYYY-MM-DDTHH:mm" in the user's
  // local timezone. We round-trip through Date so the stored ISO is
  // unambiguous UTC.
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // Format back to local "YYYY-MM-DDTHH:mm" for the input.
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DemoControlsDrawer: React.FC<DemoControlsDrawerProps> = ({
  breakerNames = DEFAULT_BREAKERS,
  megapackNames = DEFAULT_MEGAPACKS
}) => {
  const { userInfo } = useAuth();
  const isAdmin = userInfo?.roles?.some(r => ADMIN_ROLES.includes(r)) ?? false;

  const {
    overrides,
    setForcedNow,
    setCurtailmentCeilingKw,
    setCurrentSocPercent,
    toggleOpenBreaker,
    toggleOfflineMegapack,
    reset,
    hasAnyOverride
  } = useDemoOverrides();

  const [open, setOpen] = useState(false);

  // Demo-time forced alarms live server-side (Rocket-managed state)
  // so they show up uniformly in the SLD, /alarms, and /fdny pages.
  // The drawer treats them like any other override — load on open,
  // mutate via PUT, clear on Reset.
  const [alarmDefs, setAlarmDefs] = useState<AlarmDefinitionDto[]>([]);
  const [forcedAlarmNums, setForcedAlarmNums] = useState<number[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const [defs, cur] = await Promise.all([fetchAlarmDefinitions(), fetchForcedAlarms()]);
        if (cancelled) return;
        setAlarmDefs(defs.definitions);
        setForcedAlarmNums(cur.alarm_nums);
      } catch (err) {
        errorLog('failed to load forced alarms', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const updateForcedAlarms = useCallback(async (next: number[]) => {
    setForcedAlarmNums(next); // optimistic
    try {
      const resp = await putForcedAlarms(next);
      setForcedAlarmNums(resp.alarm_nums);
    } catch (err) {
      errorLog('failed to update forced alarms', err);
    }
  }, []);

  const addForcedAlarm = useCallback(
    (num: number) => {
      if (forcedAlarmNums.includes(num)) return;
      void updateForcedAlarms([...forcedAlarmNums, num]);
    },
    [forcedAlarmNums, updateForcedAlarms]
  );

  const removeForcedAlarm = useCallback(
    (num: number) => {
      void updateForcedAlarms(forcedAlarmNums.filter(n => n !== num));
    },
    [forcedAlarmNums, updateForcedAlarms]
  );

  const handleReset = useCallback(() => {
    reset();
    if (forcedAlarmNums.length > 0) {
      void updateForcedAlarms([]);
    }
  }, [reset, forcedAlarmNums, updateForcedAlarms]);

  const defByNum = React.useMemo(() => {
    const m = new Map<number, AlarmDefinitionDto>();
    for (const d of alarmDefs) m.set(d.alarm_num, d);
    return m;
  }, [alarmDefs]);

  const availableDefs = React.useMemo(
    () =>
      [...alarmDefs]
        .filter(d => !forcedAlarmNums.includes(d.alarm_num))
        .sort((a, b) => a.alarm_num - b.alarm_num),
    [alarmDefs, forcedAlarmNums]
  );

  const hasOverridesOrAlarms = hasAnyOverride || forcedAlarmNums.length > 0;

  if (!isAdmin) return null;

  return (
    <>
      {/* Floating bottom-right launcher. Sits above page content with
          a subtle Paper backdrop so it's discoverable but doesn't
          compete with primary actions. A small badge dot appears when
          overrides are active. */}
      <Tooltip title="Demo controls" placement="left">
        <Paper
          elevation={2}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            borderRadius: '50%',
            zIndex: theme => theme.zIndex.fab,
            opacity: 0.85,
            transition: 'opacity 0.15s',
            '&:hover': { opacity: 1 }
          }}
        >
          <Badge
            color="warning"
            variant="dot"
            invisible={!hasOverridesOrAlarms}
            overlap="circular"
          >
            <IconButton
              size="small"
              onClick={() => setOpen(true)}
              aria-label="Open demo controls"
            >
              <DemoIcon fontSize="small" />
            </IconButton>
          </Badge>
        </Paper>
      </Tooltip>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 360, p: 2 }} role="presentation">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Demo controls</Typography>
            <IconButton onClick={() => setOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These overrides only affect this browser tab. They feed the
            warning engine and the SLD's demo mode so you can rehearse a
            scenario without touching real device state.
          </Typography>

          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>Force "now"</Typography>
              <TextField
                fullWidth
                type="datetime-local"
                value={isoToDatetimeLocal(overrides.forcedNow)}
                onChange={e => setForcedNow(datetimeLocalToISO(e.target.value))}
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="Leaves real wall-clock alone when empty."
              />
              {overrides.forcedNow && (
                <Button size="small" onClick={() => setForcedNow(null)} sx={{ mt: 1 }}>
                  Clear forced time
                </Button>
              )}
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" gutterBottom>Utility curtailment</Typography>
              <TextField
                fullWidth
                type="number"
                value={overrides.curtailmentCeilingKw ?? ''}
                onChange={e => {
                  const raw = e.target.value;
                  setCurtailmentCeilingKw(raw === '' ? null : Number.parseFloat(raw));
                }}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">kW</InputAdornment> } }}
                helperText="Caps discharge — clear to lift the ceiling."
              />
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>Current SoC</Typography>
              <TextField
                fullWidth
                type="number"
                value={overrides.currentSocPercent ?? ''}
                onChange={e => {
                  const raw = e.target.value;
                  setCurrentSocPercent(raw === '' ? null : Number.parseFloat(raw));
                }}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
                helperText="Used by the discharge-runtime warning."
              />
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" gutterBottom>Breakers open</Typography>
              <FormControl fullWidth size="small">
                <InputLabel id="open-breaker-add-label">Open another breaker</InputLabel>
                <Select
                  labelId="open-breaker-add-label"
                  value=""
                  label="Open another breaker"
                  onChange={e => {
                    const name = e.target.value as string;
                    if (name) toggleOpenBreaker(name);
                  }}
                >
                  {breakerNames
                    .filter(n => !overrides.openBreakers.includes(n))
                    .map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                </Select>
              </FormControl>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
                {overrides.openBreakers.map(n => (
                  <FormControlLabel
                    key={n}
                    control={<Switch checked size="small" onChange={() => toggleOpenBreaker(n)} />}
                    label={n}
                  />
                ))}
                {overrides.openBreakers.length === 0 && (
                  <Typography variant="caption" color="text.secondary">All breakers closed.</Typography>
                )}
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>Megapacks offline</Typography>
              <FormControl fullWidth size="small">
                <InputLabel id="offline-megapack-add-label">Take a Megapack offline</InputLabel>
                <Select
                  labelId="offline-megapack-add-label"
                  value=""
                  label="Take a Megapack offline"
                  onChange={e => {
                    const name = e.target.value as string;
                    if (name) toggleOfflineMegapack(name);
                  }}
                >
                  {megapackNames
                    .filter(n => !overrides.offlineMegapacks.includes(n))
                    .map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                </Select>
              </FormControl>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
                {overrides.offlineMegapacks.map(n => (
                  <FormControlLabel
                    key={n}
                    control={<Switch checked size="small" onChange={() => toggleOfflineMegapack(n)} />}
                    label={n}
                  />
                ))}
                {overrides.offlineMegapacks.length === 0 && (
                  <Typography variant="caption" color="text.secondary">All Megapacks online.</Typography>
                )}
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" gutterBottom>Trigger alarms</Typography>
              <FormControl fullWidth size="small">
                <InputLabel id="trigger-alarm-add-label">Force an alarm on</InputLabel>
                <Select
                  labelId="trigger-alarm-add-label"
                  value=""
                  label="Force an alarm on"
                  onChange={e => {
                    const raw = e.target.value;
                    const num = typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
                    if (Number.isFinite(num)) addForcedAlarm(num);
                  }}
                  MenuProps={{ PaperProps: { sx: { maxHeight: 360 } } }}
                >
                  {availableDefs.map(d => (
                    <MenuItem key={d.alarm_num} value={d.alarm_num}>
                      <Typography component="span" variant="body2" sx={{ fontFamily: 'monospace', mr: 1 }}>
                        #{d.alarm_num}
                      </Typography>
                      <Typography component="span" variant="body2" sx={{ flexGrow: 1 }}>
                        {d.name}
                      </Typography>
                      <Chip
                        size="small"
                        label={d.severity}
                        color={getSeverityColor(d.severity)}
                        sx={{ ml: 1 }}
                      />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
                {forcedAlarmNums.map(num => {
                  const d = defByNum.get(num);
                  const label = d ? `#${num} ${d.name}` : `#${num}`;
                  const color = d ? getSeverityColor(d.severity) : 'default';
                  return (
                    <Chip
                      key={num}
                      label={label}
                      color={color}
                      onDelete={() => removeForcedAlarm(num)}
                      size="small"
                    />
                  );
                })}
                {forcedAlarmNums.length === 0 && (
                  <Typography variant="caption" color="text.secondary">
                    No alarms forced. Pick one above to drive the SLD glow / indicator and the /alarms list.
                  </Typography>
                )}
              </Stack>
            </Box>

            <Divider />

            <Button onClick={handleReset} disabled={!hasOverridesOrAlarms} color="warning">
              Reset all overrides
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </>
  );
};

export default DemoControlsDrawer;
