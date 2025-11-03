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
  SelectChangeEvent,
  TextField
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Schedule as ScheduleIcon,
  BatteryChargingFull,
  FlashOn,
  PowerSettingsNew,
  ChevronLeft,
  ChevronRight,
  CalendarMonth
} from '@mui/icons-material';
// import SiteSelector from '../components/SiteSelector/SiteSelector'; // Commented out for hard-coded site MVP
import {
  getMockDefaultTemplate,
  getMockTemplateEntries,
  createMockTemplateEntry as createMockTemplateEntryFn,
  updateMockTemplateEntry as updateMockTemplateEntryFn,
  deleteMockTemplateEntry as deleteMockTemplateEntryFn,
  getMockScheduleForDate,
  getMockScheduleEntries,
  createMockScheduleOverride,
  createMockScheduleEntry,
  updateMockScheduleEntry,
  deleteMockScheduleEntry,
  type MockScheduleTemplate,
  type MockScheduleTemplateEntry,
  type MockSchedule,
  type MockScheduleEntry
} from '../utils/mockScheduleApi';
import {
  secondsToTime,
  timeToSeconds,
  getCommandTypeLabel,
  getCommandTypeColor,
  hasTimeConflict,
  isValidHour,
  isValidMinute,
  toISODateString,
  parseISODate,
  formatScheduleDate,
  isPastDate,
  isToday,
  addDays,
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

  // View mode state
  const [viewMode, setViewMode] = useState<'default' | 'date'>('default');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Schedule state
  const [template, setTemplate] = useState<MockScheduleTemplate | null>(null);
  const [currentSchedule, setCurrentSchedule] = useState<MockSchedule | null>(null);
  const [entries, setEntries] = useState<Array<MockScheduleTemplateEntry | MockScheduleEntry>>([]);
  const [isUsingDefault, setIsUsingDefault] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [entryDialog, setEntryDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MockScheduleTemplateEntry | MockScheduleEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<MockScheduleTemplateEntry | MockScheduleEntry | null>(null);

  // Form state
  const [entryHour, setEntryHour] = useState(0);
  const [entryMinute, setEntryMinute] = useState(0);
  const [entryCommandType, setEntryCommandType] = useState<CommandType>('charge');
  const [formError, setFormError] = useState<string | null>(null);

  // Load schedule when view mode or date changes
  useEffect(() => {
    if (viewMode === 'default') {
      loadDefaultTemplate();
    } else {
      loadScheduleForDate(selectedDate);
    }
  }, [viewMode, selectedDate]);

  // Load default template (for "Default Template" view mode)
  const loadDefaultTemplate = async () => {
    setLoading(true);
    setError(null);
    setIsUsingDefault(false);
    setIsReadOnly(false);
    setCurrentSchedule(null);

    try {
      const defaultTemplate = await getMockDefaultTemplate(HARDCODED_SITE_ID);

      if (!defaultTemplate) {
        setError('No default template found for this site');
        setTemplate(null);
        setEntries([]);
        return;
      }

      setTemplate(defaultTemplate);
      const templateEntries = await getMockTemplateEntries(defaultTemplate.id);
      setEntries(templateEntries);
    } catch (err) {
      console.error('Error loading default template:', err);
      setError('Failed to load default template');
      setTemplate(null);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  // Load schedule for a specific date
  const loadScheduleForDate = async (date: Date) => {
    setLoading(true);
    setError(null);

    try {
      const dateString = toISODateString(date);
      const schedule = await getMockScheduleForDate(HARDCODED_SITE_ID, dateString);

      if (schedule) {
        // Has custom schedule override
        setCurrentSchedule(schedule);
        setIsUsingDefault(false);
        const scheduleEntries = await getMockScheduleEntries(schedule.id);
        setEntries(scheduleEntries);
      } else {
        // Using default template
        setCurrentSchedule(null);
        setIsUsingDefault(true);
        const defaultTemplate = await getMockDefaultTemplate(HARDCODED_SITE_ID);
        if (defaultTemplate) {
          setTemplate(defaultTemplate);
          const templateEntries = await getMockTemplateEntries(defaultTemplate.id);
          setEntries(templateEntries);
        } else {
          setEntries([]);
        }
      }

      // Check if date is in the past
      setIsReadOnly(isPastDate(date));
    } catch (err) {
      console.error('Error loading schedule for date:', err);
      setError('Failed to load schedule');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  // Date navigation handlers
  const handlePreviousDay = () => {
    setSelectedDate(prevDate => addDays(prevDate, -1));
  };

  const handleNextDay = () => {
    setSelectedDate(prevDate => addDays(prevDate, 1));
  };

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = parseISODate(event.target.value);
    setSelectedDate(newDate);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  // Override default handler
  const handleOverrideDefault = async () => {
    setLoading(true);
    setError(null);

    try {
      const dateString = toISODateString(selectedDate);
      const result = await createMockScheduleOverride(HARDCODED_SITE_ID, dateString);

      // Reload the schedule
      await loadScheduleForDate(selectedDate);
    } catch (err) {
      console.error('Error creating override:', err);
      setError('Failed to create custom schedule');
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

    setLoading(true);
    try {
      if (viewMode === 'default') {
        // Working with template entries
        if (!template) {
          setFormError('No template found');
          return;
        }

        if (editingEntry) {
          await updateMockTemplateEntryFn(editingEntry.id, {
            execution_offset_seconds: offsetSeconds,
            command_type: entryCommandType
          });
        } else {
          await createMockTemplateEntryFn({
            template_id: template.id,
            execution_offset_seconds: offsetSeconds,
            command_type: entryCommandType,
            is_active: true
          });
        }

        await loadDefaultTemplate();
      } else {
        // Working with schedule entries
        if (!currentSchedule) {
          setFormError('No schedule found');
          return;
        }

        if (editingEntry) {
          await updateMockScheduleEntry(editingEntry.id, {
            execution_offset_seconds: offsetSeconds,
            command_type: entryCommandType
          });
        } else {
          await createMockScheduleEntry({
            schedule_id: currentSchedule.id,
            execution_offset_seconds: offsetSeconds,
            command_type: entryCommandType,
            is_active: true
          });
        }

        await loadScheduleForDate(selectedDate);
      }

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
      if (viewMode === 'default') {
        await deleteMockTemplateEntryFn(entryToDelete.id);
        await loadDefaultTemplate();
      } else {
        await deleteMockScheduleEntry(entryToDelete.id);
        await loadScheduleForDate(selectedDate);
      }

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

  // Determine page title and actions
  const getPageTitle = () => {
    if (viewMode === 'default') {
      return 'Default Schedule';
    }
    return `Schedule for ${formatScheduleDate(selectedDate)}`;
  };

  const canEdit = !isReadOnly && (viewMode === 'default' || !isUsingDefault);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h2" gutterBottom>
        Schedule Editor
      </Typography>

      {/* View Mode Toggle */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Button
              variant={viewMode === 'default' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('default')}
            >
              Default Template
            </Button>
            <Button
              variant={viewMode === 'date' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('date')}
            >
              Date Schedule
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Date Navigation (only in date mode) */}
      {viewMode === 'date' && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <IconButton onClick={handlePreviousDay} disabled={loading}>
                <ChevronLeft />
              </IconButton>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarMonth />
                <input
                  type="date"
                  value={toISODateString(selectedDate)}
                  onChange={handleDateChange}
                  style={{
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                />
              </Box>

              <IconButton onClick={handleNextDay} disabled={loading}>
                <ChevronRight />
              </IconButton>

              <Button
                variant="outlined"
                onClick={handleToday}
                disabled={loading || isToday(selectedDate)}
              >
                Today
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Main Schedule Content */}
      {(template || currentSchedule) && (
        <>
          <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                  <Box>
                    <Typography variant="h6">
                      {getPageTitle()}
                    </Typography>
                    {viewMode === 'date' && isUsingDefault && (
                      <Chip
                        label="Using Default Schedule"
                        color="info"
                        size="small"
                        sx={{ mt: 1 }}
                      />
                    )}
                    {viewMode === 'date' && !isUsingDefault && (
                      <Chip
                        label="Custom Schedule"
                        color="success"
                        size="small"
                        sx={{ mt: 1 }}
                      />
                    )}
                    {viewMode === 'date' && isReadOnly && (
                      <Chip
                        label="Read-Only (Past Date)"
                        color="warning"
                        size="small"
                        sx={{ mt: 1, ml: 1 }}
                      />
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {viewMode === 'date' && isUsingDefault && !isReadOnly && (
                      <Button
                        variant="outlined"
                        onClick={handleOverrideDefault}
                        disabled={loading}
                      >
                        Override Default
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={handleAddEntry}
                        disabled={loading}
                      >
                        Add Command
                      </Button>
                    )}
                  </Box>
                </Box>

                {viewMode === 'default' && template?.description && (
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
                                {canEdit ? (
                                  <>
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
                                  </>
                                ) : (
                                  <Typography variant="caption" color="text.secondary">
                                    {isReadOnly ? 'Read-only' : 'View-only'}
                                  </Typography>
                                )}
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

          {viewMode === 'default' && !template && !loading && !error && (
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
