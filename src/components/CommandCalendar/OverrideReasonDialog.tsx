import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography
} from '@mui/material';
import type { ScheduleLibraryItem } from '@newtown-energy/types';
import { formatScheduleDate } from '../../utils/scheduleHelpers';

interface OverrideReasonDialogProps {
  open: boolean;
  selectedDate: Date | null;
  pendingScheduleSwitch: ScheduleLibraryItem | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

const OverrideReasonDialog: React.FC<OverrideReasonDialogProps> = ({
  open,
  selectedDate,
  pendingScheduleSwitch,
  onCancel,
  onConfirm
}) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        Override Schedule for {selectedDate && formatScheduleDate(selectedDate)}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Typography variant="body2" gutterBottom>
            You are switching to: <strong>{pendingScheduleSwitch?.name}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Optionally provide a reason for this override to help explain why this date uses a different schedule:
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Override Reason (optional)"
            placeholder="e.g., Holiday, special event, maintenance, etc."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            helperText="This will be visible when viewing this day's schedule"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onConfirm(reason)} variant="contained">
          Apply Override
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OverrideReasonDialog;
