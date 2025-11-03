import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  SelectChangeEvent
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Schedule as ScheduleIcon,
  BatteryChargingFull,
  FlashOn,
  PowerSettingsNew
} from '@mui/icons-material';
// import SiteSelector from '../components/SiteSelector/SiteSelector'; // Commented out for hard-coded site MVP
import {
  getMockDefaultTemplate,
  getMockTemplateEntries,
  createMockTemplateEntry,
  updateMockTemplateEntry,
  deleteMockTemplateEntry,
  type MockScheduleTemplate,
  type MockScheduleTemplateEntry
} from '../utils/mockScheduleApi';
import {
  secondsToTime,
  timeToSeconds,
  getCommandTypeLabel,
  getCommandTypeColor,
  hasTimeConflict,
  isValidHour,
  isValidMinute,
  type CommandType
} from '../utils/scheduleHelpers';

export const pageConfig = {
  id: 'scheduler',
  title: 'Scheduler',
  icon: ScheduleIcon
};

const SchedulerPage: React.FC = () => {
  // Hard-coded site ID for MVP (TODO: replace with site selector when sites are available)
  const HARDCODED_SITE_ID = 1;

  // State
  const [template, setTemplate] = useState<MockScheduleTemplate | null>(null);
  const [entries, setEntries] = useState<MockScheduleTemplateEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [entryDialog, setEntryDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MockScheduleTemplateEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<MockScheduleTemplateEntry | null>(null);

  // Form state
  const [entryHour, setEntryHour] = useState(0);
  const [entryMinute, setEntryMinute] = useState(0);
  const [entryCommandType, setEntryCommandType] = useState<CommandType>('charge');
  const [formError, setFormError] = useState<string | null>(null);

  // Load template and entries on mount
  useEffect(() => {
    loadTemplateAndEntries();
  }, []);

  const loadTemplateAndEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get default template for hard-coded site
      const defaultTemplate = await getMockDefaultTemplate(HARDCODED_SITE_ID);

      if (!defaultTemplate) {
        setError('No default template found for this site');
        setTemplate(null);
        setEntries([]);
        return;
      }

      setTemplate(defaultTemplate);

      // Get template entries
      const templateEntries = await getMockTemplateEntries(defaultTemplate.id);
      setEntries(templateEntries);
    } catch (err) {
      console.error('Error loading template:', err);
      setError('Failed to load schedule template');
      setTemplate(null);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  // Open dialog for adding new entry
  const handleAddEntry = () => {
    setEditingEntry(null);
    setEntryHour(0);
    setEntryMinute(0);
    setEntryCommandType('charge');
    setFormError(null);
    setEntryDialog(true);
  };

  // Open dialog for editing existing entry
  const handleEditEntry = (entry: MockScheduleTemplateEntry) => {
    setEditingEntry(entry);
    const hours = Math.floor(entry.execution_offset_seconds / 3600);
    const minutes = Math.floor((entry.execution_offset_seconds % 3600) / 60);
    setEntryHour(hours);
    setEntryMinute(minutes);
    setEntryCommandType(entry.command_type);
    setFormError(null);
    setEntryDialog(true);
  };

  // Close entry dialog
  const handleCloseEntryDialog = () => {
    setEntryDialog(false);
    setEditingEntry(null);
    setFormError(null);
  };

  // Save entry (create or update)
  const handleSaveEntry = async () => {
    setFormError(null);

    // Validation
    if (!isValidHour(entryHour)) {
      setFormError('Invalid hour (must be 0-23)');
      return;
    }

    if (!isValidMinute(entryMinute)) {
      setFormError('Invalid minute (must be 0-59)');
      return;
    }

    const offsetSeconds = timeToSeconds(entryHour, entryMinute);

    // Check for time conflicts
    if (hasTimeConflict(entries, offsetSeconds, editingEntry?.id)) {
      setFormError(`A command already exists at ${secondsToTime(offsetSeconds)}`);
      return;
    }

    if (!template) {
      setFormError('No template selected');
      return;
    }

    setLoading(true);
    try {
      if (editingEntry) {
        // Update existing entry
        await updateMockTemplateEntry(editingEntry.id, {
          execution_offset_seconds: offsetSeconds,
          command_type: entryCommandType
        });
      } else {
        // Create new entry
        await createMockTemplateEntry({
          template_id: template.id,
          execution_offset_seconds: offsetSeconds,
          command_type: entryCommandType,
          is_active: true
        });
      }

      // Reload entries
      await loadTemplateAndEntries();
      handleCloseEntryDialog();
    } catch (err) {
      console.error('Error saving entry:', err);
      setFormError('Failed to save entry');
    } finally {
      setLoading(false);
    }
  };

  // Open delete confirmation dialog
  const handleDeleteClick = (entry: MockScheduleTemplateEntry) => {
    setEntryToDelete(entry);
    setDeleteDialog(true);
  };

  // Close delete dialog
  const handleCloseDeleteDialog = () => {
    setDeleteDialog(false);
    setEntryToDelete(null);
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!entryToDelete) return;

    setLoading(true);
    try {
      await deleteMockTemplateEntry(entryToDelete.id);
      await loadTemplateAndEntries();
      handleCloseDeleteDialog();
      // Also close entry dialog if it's open
      if (entryDialog && editingEntry?.id === entryToDelete.id) {
        handleCloseEntryDialog();
      }
    } catch (err) {
      console.error('Error deleting entry:', err);
      setError('Failed to delete entry');
    } finally {
      setLoading(false);
    }
  };

  // Get icon for command type
  const getCommandIcon = (type: CommandType) => {
    switch (type) {
      case 'charge':
        return <BatteryChargingFull fontSize="small" />;
      case 'discharge':
        return <FlashOn fontSize="small" />;
      case 'trickle_charge':
        return <PowerSettingsNew fontSize="small" />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h2" gutterBottom>
        Default Schedule Editor
      </Typography>

      {/* Main Content */}
      {true && (
        <>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {template && (
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Schedule: {template.name}
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={handleAddEntry}
                    disabled={loading}
                  >
                    Add Command
                  </Button>
                </Box>

                {template.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {template.description}
                  </Typography>
                )}

                {loading && entries.length === 0 ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Time</TableCell>
                          <TableCell>Command Type</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {entries.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} sx={{ textAlign: 'center', py: 3 }}>
                              No commands scheduled. Click "Add Command" to get started.
                            </TableCell>
                          </TableRow>
                        ) : (
                          entries.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell>
                                <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 'medium' }}>
                                  {secondsToTime(entry.execution_offset_seconds)}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  icon={getCommandIcon(entry.command_type)}
                                  label={getCommandTypeLabel(entry.command_type)}
                                  color={getCommandTypeColor(entry.command_type)}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell align="right">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEditEntry(entry)}
                                  disabled={loading}
                                  title="Edit command"
                                >
                                  <Edit />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleDeleteClick(entry)}
                                  disabled={loading}
                                  color="error"
                                  title="Delete command"
                                >
                                  <Delete />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          )}

          {!template && !loading && !error && (
            <Alert severity="info">
              No default template found for this site. Please create one in the template manager.
            </Alert>
          )}
        </>
      )}

      {/* Add/Edit Entry Dialog */}
      <Dialog open={entryDialog} onClose={handleCloseEntryDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingEntry ? `Edit Command at ${secondsToTime(editingEntry.execution_offset_seconds)}` : 'Add Command'}
        </DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            {/* Time Selection */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Time
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel>Hour</InputLabel>
                  <Select
                    value={entryHour}
                    label="Hour"
                    onChange={(e: SelectChangeEvent<number>) => setEntryHour(e.target.value as number)}
                    disabled={loading}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <MenuItem key={i} value={i}>
                        {i.toString().padStart(2, '0')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Typography variant="h6">:</Typography>

                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel>Minute</InputLabel>
                  <Select
                    value={entryMinute}
                    label="Minute"
                    onChange={(e: SelectChangeEvent<number>) => setEntryMinute(e.target.value as number)}
                    disabled={loading}
                  >
                    {[0, 15, 30, 45].map((minute) => (
                      <MenuItem key={minute} value={minute}>
                        {minute.toString().padStart(2, '0')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>

            {/* Command Type Selection */}
            <FormControl component="fieldset">
              <FormLabel component="legend">Command Type</FormLabel>
              <RadioGroup
                value={entryCommandType}
                onChange={(e) => setEntryCommandType(e.target.value as CommandType)}
                sx={{ mt: 1 }}
              >
                <FormControlLabel
                  value="charge"
                  control={<Radio disabled={loading} />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BatteryChargingFull fontSize="small" color="success" />
                      Charge
                    </Box>
                  }
                />
                <FormControlLabel
                  value="discharge"
                  control={<Radio disabled={loading} />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FlashOn fontSize="small" color="warning" />
                      Discharge
                    </Box>
                  }
                />
                <FormControlLabel
                  value="trickle_charge"
                  control={<Radio disabled={loading} />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PowerSettingsNew fontSize="small" color="info" />
                      Trickle Charge
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEntryDialog} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveEntry}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Delete Command?</DialogTitle>
        <DialogContent>
          {entryToDelete && (
            <Typography>
              Are you sure you want to delete the{' '}
              <strong>{getCommandTypeLabel(entryToDelete.command_type)}</strong> command at{' '}
              <strong>{secondsToTime(entryToDelete.execution_offset_seconds)}</strong>?
            </Typography>
          )}
          <Typography sx={{ mt: 1 }} color="text.secondary">
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SchedulerPage;
