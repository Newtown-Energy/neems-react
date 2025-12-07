/**
 * Edit Confirmation Dialog Component
 *
 * Shown when user wants to edit a schedule from the calendar.
 * Offers choice to create a copy or edit the original schedule.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Box,
  Alert
} from '@mui/material';

import type { ScheduleLibraryItem } from '../../utils/mockScheduleApi';
import { isLibraryItemNameUnique } from '../../utils/mockScheduleApi';
import { formatScheduleDate } from '../../utils/scheduleHelpers';

interface EditConfirmationDialogProps {
  open: boolean;
  date: Date | null;
  libraryItem: ScheduleLibraryItem | null;
  affectedDatesCount?: number;
  onClose: () => void;
  onCreateCopy: (newName: string) => void;
  onEditOriginal: () => void;
}

const EditConfirmationDialog: React.FC<EditConfirmationDialogProps> = ({
  open,
  date,
  libraryItem,
  affectedDatesCount,
  onClose,
  onCreateCopy,
  onEditOriginal
}) => {
  const [editMode, setEditMode] = useState<'copy' | 'original'>('copy');
  const [copyName, setCopyName] = useState('');
  const [nameError, setNameError] = useState('');

  // Initialize copy name when dialog opens
  React.useEffect(() => {
    if (open && libraryItem) {
      setCopyName(`${libraryItem.name} (Copy)`);
      setNameError('');
    }
  }, [open, libraryItem]);

  // Validate name when it changes
  const handleNameChange = (newName: string) => {
    setCopyName(newName);

    if (!newName.trim()) {
      setNameError('Name is required');
    } else if (libraryItem && !isLibraryItemNameUnique(libraryItem.site_id, newName.trim())) {
      setNameError('A schedule with this name already exists');
    } else {
      setNameError('');
    }
  };

  const handleContinue = () => {
    if (editMode === 'copy') {
      if (!copyName.trim()) {
        setNameError('Name is required');
        return;
      }
      if (libraryItem && !isLibraryItemNameUnique(libraryItem.site_id, copyName.trim())) {
        setNameError('A schedule with this name already exists');
        return;
      }
      onCreateCopy(copyName.trim());
    } else {
      onEditOriginal();
    }
    onClose();
  };

  if (!date || !libraryItem) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Edit Schedule for {formatScheduleDate(date)}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Typography variant="body2" gutterBottom>
            This day is currently using: <strong>{libraryItem.name}</strong>
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            What would you like to do?
          </Typography>

          <RadioGroup
            value={editMode}
            onChange={e => setEditMode(e.target.value as 'copy' | 'original')}
          >
            <FormControlLabel
              value="copy"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body1">
                    Create a copy and edit it (recommended)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Creates a new schedule and applies it to this date only
                  </Typography>
                </Box>
              }
            />

            {editMode === 'copy' && (
              <Box sx={{ ml: 4, mt: 1, mb: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Name for new schedule"
                  value={copyName}
                  onChange={e => handleNameChange(e.target.value)}
                  required
                  error={Boolean(nameError)}
                  helperText={nameError}
                />
              </Box>
            )}

            <FormControlLabel
              value="original"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body1">
                    Edit the original schedule
                  </Typography>
                  {affectedDatesCount !== undefined && affectedDatesCount > 0 ? (
                    <Typography variant="caption" color="warning.main">
                      Warning: This will affect {affectedDatesCount} date{affectedDatesCount > 1 ? 's' : ''} using "{libraryItem.name}"
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      Changes will affect all dates using this schedule
                    </Typography>
                  )}
                </Box>
              }
            />
          </RadioGroup>

          {editMode === 'original' && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Editing the original schedule will change it for all dates where it's applied.
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleContinue}
          variant="contained"
          disabled={editMode === 'copy' && (!copyName.trim() || Boolean(nameError))}
        >
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditConfirmationDialog;
