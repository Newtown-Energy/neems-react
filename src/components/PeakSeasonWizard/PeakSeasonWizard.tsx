/**
 * Peak-Season Wizard.
 *
 * Walks the operator through the demo script's "set up a summer peak
 * season" flow in one dialog. Pre-populates each step from the site's
 * stored defaults, writes any user edits back to the site row, then
 * creates a library item from those defaults (B5) and season-fills it
 * across the chosen date range (B4).
 *
 * The wizard is intentionally additive — it doesn't delete or rewrite
 * existing rules, so re-running it just stacks another specific-date
 * rule and another library item alongside whatever was there before.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  InputAdornment,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import type { Site } from '@newtown-energy/types';

import { useSiteContext } from '../../utils/SiteContext';
import { updateSite } from '../../utils/siteApi';
import {
  createLibraryItemFromSiteDefaults,
  seasonFillApplicationRule
} from '../../utils/scheduleApi';
import { ApiError } from '../../utils/api';
import { errorLog } from '../../utils/debug';

interface PeakSeasonWizardProps {
  open: boolean;
  onClose: () => void;
  /** Fired after the wizard successfully creates the library item and
   *  the season-fill rule, so the host page can refresh its calendar. */
  onComplete?: () => void;
}

type WizardDraft = {
  power_kw: string;
  closed_loop_enabled: boolean;
  off_peak_start: string;
  off_peak_end: string;
  charge_power_kw: string;
  end_of_charge_soc: string;
  peak_revenue_start: string;
  peak_revenue_end: string;
  interconnection_max_output_kw: string;
  rebound_protection_soc_floor_percent: string;
  schedule_name: string;
  start_date: string;
  end_date: string;
  weekdays_only: boolean;
  exclude_us_federal_holidays: boolean;
};

const STEP_LABELS = [
  'Site power',
  'Off-peak charging',
  'End-of-charge SoC',
  'Peak revenue',
  'Interconnection',
  'Rebound protection',
  'Season range',
  'Review'
] as const;

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

function defaultSeasonName(start: string): string {
  if (!start) return 'Peak Season';
  const year = start.slice(0, 4);
  return `Peak Season ${year}`;
}

function defaultStartDate(): string {
  const today = new Date();
  const year = today.getMonth() >= 9 ? today.getFullYear() + 1 : today.getFullYear();
  return `${year}-06-24`;
}

function defaultEndDate(start: string): string {
  if (!start) return '';
  const year = start.slice(0, 4);
  return `${year}-09-15`;
}

function buildDraft(site: Site): WizardDraft {
  const start = defaultStartDate();
  return {
    power_kw: numericOrEmpty(site.power_kw),
    closed_loop_enabled: site.closed_loop_enabled,
    off_peak_start: minutesToTimeString(site.off_peak_start_minutes) || '00:00',
    off_peak_end: minutesToTimeString(site.off_peak_end_minutes) || '08:00',
    charge_power_kw: numericOrEmpty(site.power_kw),
    end_of_charge_soc: '100',
    peak_revenue_start: minutesToTimeString(site.peak_revenue_start_minutes) || '16:00',
    peak_revenue_end: minutesToTimeString(site.peak_revenue_end_minutes) || '20:00',
    interconnection_max_output_kw: numericOrEmpty(site.interconnection_max_output_kw),
    rebound_protection_soc_floor_percent: numericOrEmpty(
      site.rebound_protection_soc_floor_percent
    ) || '2',
    schedule_name: defaultSeasonName(start),
    start_date: start,
    end_date: defaultEndDate(start),
    weekdays_only: true,
    exclude_us_federal_holidays: true
  };
}

const PeakSeasonWizard: React.FC<PeakSeasonWizardProps> = ({ open, onClose, onComplete }) => {
  const { selectedSite, refresh } = useSiteContext();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<WizardDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ libraryItemName: string; daysCovered: number } | null>(null);

  useEffect(() => {
    if (open && selectedSite) {
      setDraft(buildDraft(selectedSite));
      setStep(0);
      setError(null);
      setResult(null);
    }
  }, [open, selectedSite]);

  const setField = <K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) => {
    setDraft(prev => (prev ? { ...prev, [key]: value } : prev));
  };

  const stepValid = useMemo(() => {
    if (!draft) return false;
    switch (step) {
      case 0:
        return draft.power_kw !== '' && Number.parseFloat(draft.power_kw) > 0;
      case 1:
        return (
          timeStringToMinutes(draft.off_peak_start) !== null &&
          timeStringToMinutes(draft.off_peak_end) !== null &&
          draft.charge_power_kw !== '' &&
          Number.parseFloat(draft.charge_power_kw) > 0
        );
      case 2: {
        const soc = Number.parseInt(draft.end_of_charge_soc, 10);
        return Number.isFinite(soc) && soc > 0 && soc <= 100;
      }
      case 3:
        return (
          timeStringToMinutes(draft.peak_revenue_start) !== null &&
          timeStringToMinutes(draft.peak_revenue_end) !== null
        );
      case 4:
        return draft.interconnection_max_output_kw !== '' &&
          Number.parseFloat(draft.interconnection_max_output_kw) > 0;
      case 5: {
        const floor = Number.parseFloat(draft.rebound_protection_soc_floor_percent);
        return Number.isFinite(floor) && floor >= 0 && floor <= 100;
      }
      case 6:
        return (
          draft.schedule_name.trim().length > 0 &&
          /^\d{4}-\d{2}-\d{2}$/.test(draft.start_date) &&
          /^\d{4}-\d{2}-\d{2}$/.test(draft.end_date) &&
          draft.start_date <= draft.end_date
        );
      case 7:
        return true;
      default:
        return false;
    }
  }, [draft, step]);

  const handleNext = () => setStep(s => Math.min(s + 1, STEP_LABELS.length - 1));
  const handleBack = () => setStep(s => Math.max(s - 1, 0));

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleApply = async () => {
    if (!draft || !selectedSite) return;
    setSubmitting(true);
    setError(null);
    try {
      // Step 1: persist any user edits back to the site row. The B5
      // endpoint reads windows straight off the site, so this must
      // happen before we build the library item.
      await updateSite(selectedSite.id, {
        name: null,
        address: null,
        latitude: null,
        longitude: null,
        company_id: null,
        ramp_duration_seconds: null,
        power_kw: Number.parseFloat(draft.power_kw),
        capacity_kwh: null,
        closed_loop_enabled: draft.closed_loop_enabled,
        off_peak_start_minutes: timeStringToMinutes(draft.off_peak_start),
        off_peak_end_minutes: timeStringToMinutes(draft.off_peak_end),
        peak_revenue_start_minutes: timeStringToMinutes(draft.peak_revenue_start),
        peak_revenue_end_minutes: timeStringToMinutes(draft.peak_revenue_end),
        interconnection_max_output_kw: Number.parseFloat(draft.interconnection_max_output_kw),
        rebound_protection_soc_floor_percent: Number.parseFloat(
          draft.rebound_protection_soc_floor_percent
        ),
        site_variant: null,
        charge_rate_percent: null,
        discharge_rate_percent: null
      });
      await refresh();

      // Step 2: create the library item from the freshly saved defaults.
      const item = await createLibraryItemFromSiteDefaults(selectedSite.id, {
        name: draft.schedule_name.trim(),
        description: `Generated by the peak-season wizard for ${draft.start_date} – ${draft.end_date}.`,
        end_of_charge_soc_percent: Number.parseInt(draft.end_of_charge_soc, 10)
      });

      // Step 3: season-fill across the chosen range.
      const fill = await seasonFillApplicationRule(item.id, {
        start_date: draft.start_date,
        end_date: draft.end_date,
        weekdays_only: draft.weekdays_only,
        exclude_us_federal_holidays: draft.exclude_us_federal_holidays,
        exclude_dates: [],
        override_reason: 'Peak-season wizard'
      });

      setResult({ libraryItemName: item.name, daysCovered: fill.applied_dates.length });
      onComplete?.();
    } catch (err) {
      errorLog('PeakSeasonWizard: apply failed', err);
      setError(err instanceof ApiError ? err.message : 'Failed to apply peak season');
    } finally {
      setSubmitting(false);
    }
  };

  if (!selectedSite || !draft) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Peak-season wizard</DialogTitle>
        <DialogContent>
          <Alert severity="info">Select a site before starting the wizard.</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  if (result) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Peak season applied</DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mb: 2 }}>
            Created <strong>{result.libraryItemName}</strong> and applied it to{' '}
            <strong>{result.daysCovered}</strong> day{result.daysCovered === 1 ? '' : 's'}.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            The calendar should now show the new schedule across the selected range,
            with federal holidays skipped per your settings.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} variant="contained">Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Peak-season wizard — {selectedSite.name}</DialogTitle>
      <DialogContent>
        <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
          {STEP_LABELS.map(label => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        <Box sx={{ minHeight: 280 }}>
          {step === 0 && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Confirm the site's nameplate power and that closed-loop control is on.
                These values drive every subsequent step.
              </Typography>
              <TextField
                label="Site power"
                value={draft.power_kw}
                onChange={e => setField('power_kw', e.target.value)}
                type="number"
                slotProps={{ input: { endAdornment: <InputAdornment position="end">kW</InputAdornment> } }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.closed_loop_enabled}
                    onChange={e => setField('closed_loop_enabled', e.target.checked)}
                  />
                }
                label="Closed-loop control enabled"
              />
              {!draft.closed_loop_enabled && (
                <Alert severity="warning">
                  Schedules will be visualized but not enforced while closed-loop is off.
                </Alert>
              )}
            </Stack>
          )}

          {step === 1 && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Off-peak charging window — when the battery may draw from the grid —
                and the charging power that should be commanded across that window.
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Off-peak start"
                    fullWidth
                    value={draft.off_peak_start}
                    onChange={e => setField('off_peak_start', e.target.value)}
                    type="time"
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Off-peak end"
                    fullWidth
                    value={draft.off_peak_end}
                    onChange={e => setField('off_peak_end', e.target.value)}
                    type="time"
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
              </Grid>
              <TextField
                label="Charging power"
                value={draft.charge_power_kw}
                onChange={e => setField('charge_power_kw', e.target.value)}
                type="number"
                slotProps={{ input: { endAdornment: <InputAdornment position="end">kW</InputAdornment> } }}
                helperText="Charging command power for the off-peak window."
              />
            </Stack>
          )}

          {step === 2 && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Target State-of-Charge to hit by the end of the off-peak window.
                The script's default is 100%.
              </Typography>
              <TextField
                label="End-of-charge SoC"
                value={draft.end_of_charge_soc}
                onChange={e => setField('end_of_charge_soc', e.target.value)}
                type="number"
                slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
              />
            </Stack>
          )}

          {step === 3 && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Peak-revenue discharge window — when the battery should be paying
                back to the grid at the higher tariff.
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Peak-revenue start"
                    fullWidth
                    value={draft.peak_revenue_start}
                    onChange={e => setField('peak_revenue_start', e.target.value)}
                    type="time"
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Peak-revenue end"
                    fullWidth
                    value={draft.peak_revenue_end}
                    onChange={e => setField('peak_revenue_end', e.target.value)}
                    type="time"
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
              </Grid>
            </Stack>
          )}

          {step === 4 && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Interconnection agreement cap. Discharge will be clamped at this
                value during the peak-revenue window.
              </Typography>
              <TextField
                label="Interconnection max output"
                value={draft.interconnection_max_output_kw}
                onChange={e => setField('interconnection_max_output_kw', e.target.value)}
                type="number"
                slotProps={{ input: { endAdornment: <InputAdornment position="end">kW</InputAdornment> } }}
              />
            </Stack>
          )}

          {step === 5 && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Rebound protection floor — the SoC at which discharge ramps back to
                zero to protect the battery from a deep-discharge rebound.
              </Typography>
              <TextField
                label="SoC floor"
                value={draft.rebound_protection_soc_floor_percent}
                onChange={e =>
                  setField('rebound_protection_soc_floor_percent', e.target.value)
                }
                type="number"
                slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
              />
            </Stack>
          )}

          {step === 6 && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Pick the season's start and end dates. Weekdays-only and the
                federal-holiday skip are on by default to match the script.
              </Typography>
              <TextField
                label="Schedule name"
                value={draft.schedule_name}
                onChange={e => setField('schedule_name', e.target.value)}
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Start date"
                    fullWidth
                    value={draft.start_date}
                    onChange={e => setField('start_date', e.target.value)}
                    type="date"
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="End date"
                    fullWidth
                    value={draft.end_date}
                    onChange={e => setField('end_date', e.target.value)}
                    type="date"
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
              </Grid>
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.weekdays_only}
                    onChange={e => setField('weekdays_only', e.target.checked)}
                  />
                }
                label="Weekdays only (skip Sat/Sun)"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.exclude_us_federal_holidays}
                    onChange={e => setField('exclude_us_federal_holidays', e.target.checked)}
                  />
                }
                label="Skip US federal holidays"
              />
            </Stack>
          )}

          {step === 7 && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Review and apply. This will save the site defaults you set above,
                create a new library item, and apply it across the chosen range
                as a single specific-date rule.
              </Typography>
              <Divider />
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}><Typography variant="body2"><strong>Site power:</strong> {draft.power_kw} kW</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="body2"><strong>Closed-loop:</strong> {draft.closed_loop_enabled ? 'on' : 'off'}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="body2"><strong>Off-peak:</strong> {draft.off_peak_start} – {draft.off_peak_end}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="body2"><strong>Charge power:</strong> {draft.charge_power_kw} kW</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="body2"><strong>End-of-charge SoC:</strong> {draft.end_of_charge_soc}%</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="body2"><strong>Peak revenue:</strong> {draft.peak_revenue_start} – {draft.peak_revenue_end}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="body2"><strong>Interconnection cap:</strong> {draft.interconnection_max_output_kw} kW</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="body2"><strong>Rebound floor:</strong> {draft.rebound_protection_soc_floor_percent}%</Typography></Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="body2">
                    <strong>{draft.schedule_name}</strong> applied{' '}
                    {draft.start_date} → {draft.end_date}
                    {draft.weekdays_only ? ', weekdays only' : ''}
                    {draft.exclude_us_federal_holidays ? ', skipping federal holidays' : ''}.
                  </Typography>
                </Grid>
              </Grid>
            </Stack>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>Cancel</Button>
        <Button onClick={handleBack} disabled={step === 0 || submitting}>Back</Button>
        {step < STEP_LABELS.length - 1 ? (
          <Button onClick={handleNext} variant="contained" disabled={!stepValid}>
            Next
          </Button>
        ) : (
          <Button onClick={handleApply} variant="contained" disabled={submitting || !stepValid}>
            {submitting ? 'Applying…' : 'Apply'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default PeakSeasonWizard;
