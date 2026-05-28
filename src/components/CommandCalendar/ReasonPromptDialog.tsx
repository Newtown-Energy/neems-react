/**
 * Generic "reason for change" prompt used by the inline command-edit
 * flows on `DayDetailsDialog` (S1b). Kept distinct from the
 * apply-different `OverrideReasonDialog` because that one knows about
 * the schedule being switched to and reads better when its copy stays
 * specific to that workflow.
 *
 * The reason is required: the Apply button is disabled while the
 * TextField is empty / whitespace-only.
 */

import React, { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography
} from '@mui/material';

interface ReasonPromptDialogProps {
  open: boolean;
  title: string;
  /** One-sentence explainer rendered above the input. */
  description?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

const ReasonPromptDialog: React.FC<ReasonPromptDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Apply',
  onCancel,
  onConfirm
}) => {
  const [reason, setReason] = useState('');

  // Reset on each opening so a previous reason doesn't leak across
  // unrelated operations.
  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const trimmed = reason.trim();
  const empty = trimmed.length === 0;

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {description}
          </Typography>
        )}
        <TextField
          autoFocus
          fullWidth
          required
          multiline
          rows={3}
          label="Reason for change"
          placeholder="e.g., RTAC fault, manual override, operator request, etc."
          value={reason}
          onChange={e => setReason(e.target.value)}
          helperText="Required — appears in the per-day change history."
          error={empty}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onConfirm(trimmed)} variant="contained" disabled={empty}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReasonPromptDialog;
