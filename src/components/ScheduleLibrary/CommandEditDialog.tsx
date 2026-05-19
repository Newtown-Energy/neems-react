import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import type { ScheduleCommandDto } from '@newtown-energy/types';
import {
  durationToSeconds,
  secondsToDuration,
  timeToSeconds
} from '../../utils/scheduleHelpers';
import {
  evaluateCommandWarnings
} from '../../utils/scheduleWarnings';
import { useSiteContext } from '../../utils/SiteContext';
// Note: this dialog used to read demo overrides (breakers, megapacks,
// curtailment, current SoC) into the warning engine. Those are
// site-state facts, not properties of a future command, so they moved
// to the app-wide SiteStatePanel banner via evaluateSiteState.

interface CommandEditDialogProps {
  open: boolean;
  initialCommand: ScheduleCommandDto | null;
  existingCommands: ScheduleCommandDto[];
  onSave: (command: ScheduleCommandDto) => void;
  onClose: () => void;
  onError?: (message: string) => void;
}

const CommandEditDialog: React.FC<CommandEditDialogProps> = ({
  open,
  initialCommand,
  existingCommands,
  onSave,
  onClose,
  onError
}) => {
  const { selectedSite } = useSiteContext();
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);
  const [type, setType] = useState<'charge' | 'discharge' | 'trickle_charge'>('charge');
  const [durationHours, setDurationHours] = useState<number | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [targetSoc, setTargetSoc] = useState<number | null>(null);
  const [sessionDismissed, setSessionDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    if (initialCommand) {
      setHour(Math.floor(initialCommand.execution_offset_seconds / 3600));
      setMinute(Math.floor((initialCommand.execution_offset_seconds % 3600) / 60));
      setType(initialCommand.command_type);
      if (initialCommand.duration_seconds !== null && initialCommand.duration_seconds !== undefined) {
        const duration = secondsToDuration(initialCommand.duration_seconds);
        setDurationHours(duration.hours);
        setDurationMinutes(duration.minutes);
      } else {
        setDurationHours(null);
        setDurationMinutes(null);
      }
      setTargetSoc(initialCommand.target_soc_percent ?? null);
    } else {
      setHour(0);
      setMinute(0);
      setType('charge');
      setDurationHours(null);
      setDurationMinutes(null);
      setTargetSoc(null);
    }
    setSessionDismissed(new Set());
  }, [open, initialCommand]);

  // Build a synthetic command from the current draft state so warnings
  // update live as the user edits. We use the initial id when editing
  // so the warning [key]s stay stable across edits of the same row.
  const draftCommand: ScheduleCommandDto = useMemo(() => {
    const offsetSeconds = timeToSeconds(hour, minute);
    let durationSeconds: number | null = null;
    if (durationHours !== null || durationMinutes !== null) {
      const d = durationToSeconds(durationHours ?? 0, durationMinutes ?? 0);
      durationSeconds = d === 0 ? null : d;
    }
    return {
      id: initialCommand?.id ?? -1,
      execution_offset_seconds: offsetSeconds,
      command_type: type,
      duration_seconds: durationSeconds,
      target_soc_percent: targetSoc
    };
  }, [hour, minute, type, durationHours, durationMinutes, targetSoc, initialCommand?.id]);

  const warnings = useMemo(() => {
    if (!selectedSite) return [];
    const all = evaluateCommandWarnings(draftCommand, selectedSite);
    return all.filter(w => !sessionDismissed.has(w.key));
  }, [draftCommand, selectedSite, sessionDismissed]);

  const handleDismiss = (key: string) => {
    setSessionDismissed(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const handleSave = () => {
    const offsetSeconds = timeToSeconds(hour, minute);

    const conflict = existingCommands.some(cmd =>
      cmd.id !== initialCommand?.id && cmd.execution_offset_seconds === offsetSeconds
    );
    if (conflict) {
      onError?.('A command already exists at this time');
      return;
    }

    let durationSeconds: number | null = null;
    if (durationHours !== null || durationMinutes !== null) {
      durationSeconds = durationToSeconds(durationHours ?? 0, durationMinutes ?? 0);
      if (durationSeconds === 0) {
        durationSeconds = null;
      }
    }

    onSave({
      id: initialCommand?.id ?? Date.now(),
      execution_offset_seconds: offsetSeconds,
      command_type: type,
      duration_seconds: durationSeconds,
      target_soc_percent: targetSoc
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {initialCommand ? 'Edit Command' : 'Add Command'}
      </DialogTitle>
      <DialogContent>
        {warnings.length > 0 && (
          <Stack spacing={1} sx={{ pt: 2 }}>
            {warnings.map(w => (
              <Alert
                key={w.key}
                severity={w.severity}
                action={
                  w.dismissible ? (
                    <IconButton
                      size="small"
                      color="inherit"
                      onClick={() => handleDismiss(w.key)}
                      aria-label="Dismiss warning"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  ) : undefined
                }
              >
                {w.message}
              </Alert>
            ))}
          </Stack>
        )}
        <Box sx={{ pt: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Execution Time</Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Hour</InputLabel>
              <Select
                value={hour}
                label="Hour"
                onChange={e => setHour(Number(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <MenuItem key={i} value={i}>
                    {i.toString().padStart(2, '0')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Minute</InputLabel>
              <Select
                value={minute}
                label="Minute"
                onChange={e => setMinute(Number(e.target.value))}
              >
                {[0, 15, 30, 45].map(m => (
                  <MenuItem key={m} value={m}>
                    {m.toString().padStart(2, '0')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Command Type</InputLabel>
            <Select
              value={type}
              label="Command Type"
              onChange={e => setType(e.target.value as 'charge' | 'discharge' | 'trickle_charge')}
            >
              <MenuItem value="charge">Charge</MenuItem>
              <MenuItem value="discharge">Discharge</MenuItem>
              <MenuItem value="trickle_charge">Trickle Charge</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="subtitle2" sx={{ mb: 1 }}>Duration (optional)</Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Hours</InputLabel>
              <Select
                value={durationHours ?? ''}
                label="Hours"
                onChange={e => {
                  const raw = e.target.value as number | '';
                  setDurationHours(raw === '' ? null : Number(raw));
                }}
              >
                <MenuItem value="">-</MenuItem>
                {Array.from({ length: 24 }, (_, i) => (
                  <MenuItem key={i} value={i}>{i}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Minutes</InputLabel>
              <Select
                value={durationMinutes ?? ''}
                label="Minutes"
                onChange={e => {
                  const raw = e.target.value as number | '';
                  setDurationMinutes(raw === '' ? null : Number(raw));
                }}
              >
                <MenuItem value="">-</MenuItem>
                {[0, 15, 30, 45].map(m => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Typography variant="subtitle2" sx={{ mb: 1 }}>Target State of Charge (optional)</Typography>
          <TextField
            fullWidth
            type="number"
            label="Target SOC %"
            value={targetSoc ?? ''}
            onChange={e => {
              const value = e.target.value;
              if (value === '') {
                setTargetSoc(null);
              } else {
                const num = parseInt(value, 10);
                if (!isNaN(num) && num >= 0 && num <= 100) {
                  setTargetSoc(num);
                }
              }
            }}
            InputProps={{ inputProps: { min: 0, max: 100 } }}
            helperText="Enter a value between 0 and 100"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
};

export default CommandEditDialog;
