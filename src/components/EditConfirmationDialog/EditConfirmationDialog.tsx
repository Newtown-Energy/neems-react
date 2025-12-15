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

import type { ScheduleLibraryItem } from '../../types/generated/ScheduleLibraryItem';
import { getLibraryItems } from '../../utils/scheduleApi';
import { formatScheduleDate } from '../../utils/scheduleHelpers';

/**
 * Generates a unique copy name with incrementing version numbers.
 * Examples:
 * - "Schedule Foo" -> "Schedule Foo (2)"
 * - "Schedule Foo (2)" when "Schedule Foo (3)" exists -> "Schedule Foo (4)"
 * - "Schedule Winter 2025" -> "Schedule Winter 2025 (2)"
 */
const getNextCopyName = (currentName: string, siteId: number, allItems: ScheduleLibraryItem[]): string => {
  // Extract base name by removing trailing version number (if any)
  const versionPattern = /\s*\((\d+)\)$/;
  const match = currentName.match(versionPattern);
  const baseName = match ? currentName.replace(versionPattern, '') : currentName;

  // Find all schedules with the same base name
  const relatedNames = allItems
    .filter(item => item.site_id === siteId)
    .map(item => item.name)
    .filter(name => {
      // Check if name matches the base name (with or without version number)
      if (name === baseName) return true;
      const nameMatch = name.match(/^(.+?)\s*\((\d+)\)$/);
      return nameMatch && nameMatch[1] === baseName;
    });

  // Extract version numbers and find the highest
  let highestVersion = 1; // Start at 1 since the original doesn't have a number
  relatedNames.forEach(name => {
    const versionMatch = name.match(/\((\d+)\)$/);
    if (versionMatch) {
      const version = parseInt(versionMatch[1], 10);
      if (version > highestVersion) {
        highestVersion = version;
      }
    }
  });

  // Return the next version
  return `${baseName} (${highestVersion + 1})`;
};

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
    const initializeCopyName = async () => {
      if (open && libraryItem) {
        try {
          const allItems = await getLibraryItems(libraryItem.site_id);
          const nextName = getNextCopyName(libraryItem.name, libraryItem.site_id, allItems);
          setCopyName(nextName);
          setNameError('');
        } catch (err) {
          console.error('Error generating copy name:', err);
          // Fallback to simple copy name
          setCopyName(`${libraryItem.name} (2)`);
          setNameError('');
        }
      }
    };

    void initializeCopyName();
  }, [open, libraryItem]);

  // Validate name when it changes
  const handleNameChange = (newName: string) => {
    setCopyName(newName);

    if (!newName.trim()) {
      setNameError('Name is required');
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
