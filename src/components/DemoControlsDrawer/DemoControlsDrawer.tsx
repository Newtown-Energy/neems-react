/**
 * Demo Controls Drawer.
 *
 * A right-edge drawer that exposes the live state knobs used during a
 * demo: forced wall-clock, utility curtailment ceiling, current SoC,
 * open breakers, and offline Megapacks. Values flow into the schedule
 * warning engine and the SLD's `demoMode` plumbing via the demo
 * overrides context.
 *
 * Access is gated to operators with an admin-flavored role so the
 * "force breaker B-1 open" button doesn't surface to view-only users.
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
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

import { useDemoOverrides } from '../../utils/demoOverrides';

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

  return (
    <>
      <Tooltip title="Demo controls">
        <IconButton
          color={hasAnyOverride ? 'warning' : 'default'}
          onClick={() => setOpen(true)}
          aria-label="Open demo controls"
        >
          <DemoIcon />
        </IconButton>
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

            <Button onClick={reset} disabled={!hasAnyOverride} color="warning">
              Reset all overrides
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </>
  );
};

export default DemoControlsDrawer;
