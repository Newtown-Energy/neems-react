import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography
} from '@mui/material';
import type { ScheduleCommandDto } from '@newtown-energy/types';
import {
  durationToSeconds,
  secondsToDuration,
  timeToSeconds
} from '../../utils/scheduleHelpers';

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
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);
  const [type, setType] = useState<'charge' | 'discharge' | 'trickle_charge'>('charge');
  const [durationHours, setDurationHours] = useState<number | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [targetSoc, setTargetSoc] = useState<number | null>(null);

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
  }, [open, initialCommand]);

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
                onChange={e => setDurationHours(e.target.value === '' ? null : Number(e.target.value))}
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
                onChange={e => setDurationMinutes(e.target.value === '' ? null : Number(e.target.value))}
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
