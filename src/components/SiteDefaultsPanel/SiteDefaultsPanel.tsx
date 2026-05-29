/**
 * Site Defaults Panel.
 *
 * Editable form for the demo-driven site configuration: power, capacity,
 * ramp rate, closed-loop toggle, off-peak window, peak-revenue window,
 * interconnection cap, rebound-protection floor, site variant. Each save
 * round-trips through `PUT /api/1/Sites/<id>`; the panel does not assume
 * sole ownership of the row so unrelated edits (name, address) made
 * elsewhere stay intact.
 *
 * Designed to be rendered inside a Dialog: it has no internal title,
 * no Paper wrapper, and no Save button. The parent owns its dialog
 * chrome (title, action buttons) and triggers a save via the ref-exposed
 * `save()` method. The panel reports its busy state via the
 * `onSavingChange` callback so the parent can disable the Save button
 * while a write is in flight.
 */

import React, {
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type Ref
} from 'react';
import {
  Alert,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
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
import { HelpOutline } from '@mui/icons-material';
import type { Site, SiteVariant } from '@newtown-energy/types';

import { useSiteContext } from '../../utils/SiteContext';
import { updateSite } from '../../utils/siteApi';
import { ApiError } from '../../utils/api';
import { errorLog } from '../../utils/debug';

type DraftSiteDefaults = {
  power_kw: string;
  capacity_kwh: string;
  ramp_duration_seconds: string;
  off_peak_start: string;
  off_peak_end: string;
  peak_revenue_start: string;
  peak_revenue_end: string;
  interconnection_max_output_kw: string;
  rebound_protection_soc_floor_percent: string;
  closed_loop_enabled: boolean;
  site_variant: SiteVariant;
  charge_rate_percent: string;
  discharge_rate_percent: string;
};

function minutesToTimeString(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '';
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function timeStringToMinutes(value: string): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const hours = Number.parseInt(m[1], 10);
  const mins = Number.parseInt(m[2], 10);
  if (hours < 0 || hours > 23 || mins < 0 || mins > 59) return null;
  return hours * 60 + mins;
}

function numericOrEmpty(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function isRateOutOfRange(value: string): boolean {
  if (value === '') return false;
  const n = Number.parseFloat(value);
  return Number.isNaN(n) || n < 0 || n > 100;
}

function siteToDraft(site: Site): DraftSiteDefaults {
  return {
    power_kw: numericOrEmpty(site.power_kw),
    capacity_kwh: numericOrEmpty(site.capacity_kwh),
    ramp_duration_seconds: numericOrEmpty(site.ramp_duration_seconds),
    off_peak_start: minutesToTimeString(site.off_peak_start_minutes),
    off_peak_end: minutesToTimeString(site.off_peak_end_minutes),
    peak_revenue_start: minutesToTimeString(site.peak_revenue_start_minutes),
    peak_revenue_end: minutesToTimeString(site.peak_revenue_end_minutes),
    interconnection_max_output_kw: numericOrEmpty(site.interconnection_max_output_kw),
    rebound_protection_soc_floor_percent: numericOrEmpty(
      site.rebound_protection_soc_floor_percent
    ),
    closed_loop_enabled: site.closed_loop_enabled,
    site_variant: (site.site_variant as SiteVariant) ?? 'standard',
    charge_rate_percent: numericOrEmpty(site.charge_rate_percent),
    discharge_rate_percent: numericOrEmpty(site.discharge_rate_percent)
  };
}

export interface SiteDefaultsPanelHandle {
  /**
   * Persist the current draft. Resolves to true on success, false on
   * failure. The panel surfaces its own success/error alert either way.
   */
  save: () => Promise<boolean>;
}

interface SiteDefaultsPanelProps {
  /**
   * Called whenever the saving state flips. Lets the parent dialog
   * disable its Save button without us re-exposing internal state.
   */
  onSavingChange?: (saving: boolean) => void;
  /** React 19 ref-as-prop. Exposes [SiteDefaultsPanelHandle]. */
  ref?: Ref<SiteDefaultsPanelHandle>;
}

const FIELD_HELP: Record<string, string> = {
  power_kw:
    'Nameplate power of the battery system. Drives charge/discharge command sizing and the ramp-rate calculation.',
  capacity_kwh:
    'Total energy storage capacity. Used for the available-SoC duration warning.',
  ramp_duration_seconds:
    'Time to ramp from 0 to full power. ConEd standard is 120 seconds (2-minute full-power ramp).',
  closed_loop_enabled:
    'When on, scheduled commands are sent to the RTAC for execution. When off, schedules are visualized but not enforced.',
  charge_rate_percent:
    'Percentage of nameplate power used for charge commands. 100% = full power. Drives the calendar bar height.',
  discharge_rate_percent:
    'Percentage of nameplate power used for discharge commands. 100% = full power. Drives the calendar bar height.',
  off_peak_window:
    'Off-peak charging window — when the battery may draw from the grid at the lower tariff.',
  peak_revenue_window:
    'Peak-revenue discharge window — when the battery should be paying back to the grid at the higher tariff.',
  interconnection_max_output_kw:
    'Discharge cap from the interconnection agreement. Discharge commands will be clamped at this value.',
  rebound_protection_soc_floor_percent:
    'State-of-charge at which discharge ramps to 0 kW to protect the battery from a deep-discharge rebound.',
  site_variant:
    'Determines hardware constraints. "No grid charge" means inverters cannot charge from the grid.',
};

const FieldHelp: React.FC<{ field: string }> = ({ field }) => {
  const tip = FIELD_HELP[field];
  if (!tip) return null;
  return (
    <Tooltip
      title={tip}
      arrow
      placement="top"
      slotProps={{
        tooltip: { sx: { fontSize: '0.8rem', lineHeight: 1.5, maxWidth: 320, p: 1 } },
      }}
    >
      <HelpOutline
        sx={{ fontSize: 20, ml: 0.5, verticalAlign: 'text-bottom', color: 'action.active', cursor: 'help' }}
      />
    </Tooltip>
  );
};

const SiteDefaultsPanel: React.FC<SiteDefaultsPanelProps> = ({ onSavingChange, ref }) => {
  const { selectedSite, refresh } = useSiteContext();
  const [draft, setDraft] = useState<DraftSiteDefaults | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (selectedSite) setDraft(siteToDraft(selectedSite));
  }, [selectedSite]);

  useEffect(() => {
    onSavingChange?.(saving);
  }, [saving, onSavingChange]);

  // Auto-derived ramp rate: floor(power_kw / 120s) — only used as a hint;
  // the user can override the duration directly.
  const autoRampDurationSeconds = useMemo(() => {
    const power = Number.parseFloat(draft?.power_kw ?? '');
    return Number.isFinite(power) && power > 0 ? 120 : null;
  }, [draft?.power_kw]);

  /**
   * Live ramp-rate readout derived from the user's current power +
   * duration draft, surfaced inline so operators see what their config
   * actually means in kW/minute (per-minute is the format ConEd uses
   * when negotiating interconnection terms).
   *
   * Returns null when either input is empty or non-positive so the UI
   * can fall back to a generic helper line.
   */
  const rampRateKwPerMin = useMemo(() => {
    const power = Number.parseFloat(draft?.power_kw ?? '');
    const duration = Number.parseFloat(draft?.ramp_duration_seconds ?? '');
    if (!Number.isFinite(power) || power <= 0) return null;
    if (!Number.isFinite(duration) || duration <= 0) return null;
    return (power / duration) * 60;
  }, [draft?.power_kw, draft?.ramp_duration_seconds]);

  const handleSave = async (): Promise<boolean> => {
    if (!draft || !selectedSite) return false;
    setSaving(true);
    setError(null);
    try {
      const power = draft.power_kw === '' ? null : Number.parseFloat(draft.power_kw);
      const capacity = draft.capacity_kwh === '' ? null : Number.parseFloat(draft.capacity_kwh);
      const ramp = draft.ramp_duration_seconds === ''
        ? null
        : Number.parseInt(draft.ramp_duration_seconds, 10);
      const interconnection = draft.interconnection_max_output_kw === ''
        ? null
        : Number.parseFloat(draft.interconnection_max_output_kw);
      const reboundFloor = draft.rebound_protection_soc_floor_percent === ''
        ? null
        : Number.parseFloat(draft.rebound_protection_soc_floor_percent);
      const chargeRate = draft.charge_rate_percent === ''
        ? null
        : Number.parseFloat(draft.charge_rate_percent);
      const dischargeRate = draft.discharge_rate_percent === ''
        ? null
        : Number.parseFloat(draft.discharge_rate_percent);

      // Rates are bounded percentages: bail before the round-trip so the
      // operator sees the problem inline instead of as a backend 400.
      const outOfRange = (v: number | null) =>
        v !== null && (Number.isNaN(v) || v < 0 || v > 100);
      if (outOfRange(chargeRate) || outOfRange(dischargeRate)) {
        setError('Charge and discharge rate must be between 0 and 100%.');
        setSaving(false);
        return false;
      }

      await updateSite(selectedSite.id, {
        // Server treats `null` as "leave alone" for some fields, so we
        // pass null for the ones we never edit (name, address, etc.).
        name: null,
        address: null,
        latitude: null,
        longitude: null,
        company_id: null,
        ramp_duration_seconds: ramp ?? null,
        power_kw: power,
        capacity_kwh: capacity,
        closed_loop_enabled: draft.closed_loop_enabled,
        off_peak_start_minutes: timeStringToMinutes(draft.off_peak_start),
        off_peak_end_minutes: timeStringToMinutes(draft.off_peak_end),
        peak_revenue_start_minutes: timeStringToMinutes(draft.peak_revenue_start),
        peak_revenue_end_minutes: timeStringToMinutes(draft.peak_revenue_end),
        interconnection_max_output_kw: interconnection,
        rebound_protection_soc_floor_percent: reboundFloor,
        site_variant: draft.site_variant,
        charge_rate_percent: chargeRate,
        discharge_rate_percent: dischargeRate
      });
      await refresh();
      setSavedAt(Date.now());
      return true;
    } catch (err) {
      errorLog('SiteDefaultsPanel: save failed', err);
      setError(err instanceof ApiError ? err.message : 'Failed to save site defaults');
      return false;
    } finally {
      setSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({ save: handleSave }), [handleSave]);

  if (!selectedSite || !draft) {
    return (
      <Typography variant="body2" color="text.secondary">
        Select a site to view its defaults.
      </Typography>
    );
  }

  const setField = <K extends keyof DraftSiteDefaults>(
    key: K,
    value: DraftSiteDefaults[K]
  ) => {
    setDraft(prev => (prev ? { ...prev, [key]: value } : prev));
    setSavedAt(null);
  };

  return (
    <Stack spacing={3}>
      <Typography variant="body2" color="text.secondary">
        These values drive the peak-season wizard, scheduling warnings, and the
        calendar's bar visualization. Edits persist on save.
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}
        {savedAt && !error && (
          <Alert severity="success" onClose={() => setSavedAt(null)}>
            Defaults saved.
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label={<>Site power<FieldHelp field="power_kw" /></>}
              fullWidth
              value={draft.power_kw}
              onChange={e => setField('power_kw', e.target.value)}
              slotProps={{ input: { endAdornment: <InputAdornment position="end">kW</InputAdornment> } }}
              type="number"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label={<>Site capacity<FieldHelp field="capacity_kwh" /></>}
              fullWidth
              value={draft.capacity_kwh}
              onChange={e => setField('capacity_kwh', e.target.value)}
              slotProps={{ input: { endAdornment: <InputAdornment position="end">kWh</InputAdornment> } }}
              type="number"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label={<>Max ramp duration<FieldHelp field="ramp_duration_seconds" /></>}
              fullWidth
              value={draft.ramp_duration_seconds}
              onChange={e => setField('ramp_duration_seconds', e.target.value)}
              slotProps={{ input: { endAdornment: <InputAdornment position="end">s</InputAdornment> } }}
              type="number"
              helperText={
                rampRateKwPerMin != null
                  ? `≈ ${Math.round(rampRateKwPerMin).toLocaleString()} kW/min ramp rate at current power.`
                  : autoRampDurationSeconds
                    ? `Auto-suggested: ${autoRampDurationSeconds}s (matches ConEd 2-min full-power ramp).`
                    : 'Time to ramp from 0 to full power. Default is 120s.'
              }
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={draft.closed_loop_enabled}
                  onChange={e => setField('closed_loop_enabled', e.target.checked)}
                />
              }
              label={<>Closed-loop control enabled<FieldHelp field="closed_loop_enabled" /></>}
            />
            {!draft.closed_loop_enabled && (
              <Typography variant="caption" color="warning.main" display="block">
                Schedules will be visualized but not enforced while closed-loop is off.
              </Typography>
            )}
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label={<>Charge rate<FieldHelp field="charge_rate_percent" /></>}
              fullWidth
              value={draft.charge_rate_percent}
              onChange={e => setField('charge_rate_percent', e.target.value)}
              slotProps={{
                input: { endAdornment: <InputAdornment position="end">% of power</InputAdornment> },
                htmlInput: { min: 0, max: 100, step: 1 }
              }}
              type="number"
              error={isRateOutOfRange(draft.charge_rate_percent)}
              helperText={
                isRateOutOfRange(draft.charge_rate_percent)
                  ? 'Must be between 0 and 100.'
                  : '100 = full power. Drives the calendar\'s orange bar height.'
              }
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label={<>Discharge rate<FieldHelp field="discharge_rate_percent" /></>}
              fullWidth
              value={draft.discharge_rate_percent}
              onChange={e => setField('discharge_rate_percent', e.target.value)}
              slotProps={{
                input: { endAdornment: <InputAdornment position="end">% of power</InputAdornment> },
                htmlInput: { min: 0, max: 100, step: 1 }
              }}
              type="number"
              error={isRateOutOfRange(draft.discharge_rate_percent)}
              helperText={
                isRateOutOfRange(draft.discharge_rate_percent)
                  ? 'Must be between 0 and 100.'
                  : '100 = full power. Drives the calendar\'s blue bar height.'
              }
            />
          </Grid>
        </Grid>

        <Divider />

        <Typography variant="subtitle1">Off-peak charging window<FieldHelp field="off_peak_window" /></Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }}>
            <TextField
              label="Start"
              fullWidth
              value={draft.off_peak_start}
              onChange={e => setField('off_peak_start', e.target.value)}
              type="time"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField
              label="End"
              fullWidth
              value={draft.off_peak_end}
              onChange={e => setField('off_peak_end', e.target.value)}
              type="time"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
        </Grid>

        <Typography variant="subtitle1">Peak-revenue discharge window<FieldHelp field="peak_revenue_window" /></Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }}>
            <TextField
              label="Start"
              fullWidth
              value={draft.peak_revenue_start}
              onChange={e => setField('peak_revenue_start', e.target.value)}
              type="time"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField
              label="End"
              fullWidth
              value={draft.peak_revenue_end}
              onChange={e => setField('peak_revenue_end', e.target.value)}
              type="time"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
        </Grid>

        <Divider />

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label={<>Interconnection max output<FieldHelp field="interconnection_max_output_kw" /></>}
              fullWidth
              value={draft.interconnection_max_output_kw}
              onChange={e => setField('interconnection_max_output_kw', e.target.value)}
              slotProps={{ input: { endAdornment: <InputAdornment position="end">kW</InputAdornment> } }}
              type="number"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label={<>Rebound protection SoC floor<FieldHelp field="rebound_protection_soc_floor_percent" /></>}
              fullWidth
              value={draft.rebound_protection_soc_floor_percent}
              onChange={e =>
                setField('rebound_protection_soc_floor_percent', e.target.value)
              }
              slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
              type="number"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel id="site-variant-label">Site variant<FieldHelp field="site_variant" /></InputLabel>
              <Select
                labelId="site-variant-label"
                value={draft.site_variant}
                label="Site variant"
                onChange={e => setField('site_variant', e.target.value as SiteVariant)}
              >
                <MenuItem value="standard">Standard interconnect</MenuItem>
                <MenuItem value="no_grid_charge">No grid charge (inverters cannot charge from grid)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

    </Stack>
  );
};

export default SiteDefaultsPanel;
