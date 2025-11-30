/**
 * Schedule Library Component
 *
 * Displays and manages the library of reusable schedule templates.
 * Each library item can have application rules that determine when it's used.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CalendarMonth as CalendarMonthIcon,
  Star as StarIcon,
  Loop as LoopIcon,
  Event as EventIcon
} from '@mui/icons-material';

import type { ScheduleLibraryItem, ApplicationRule, ScheduleCommand } from '../../utils/mockScheduleApi';
import {
  getLibraryItems,
  createLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
  getAllApplicationRules
} from '../../utils/mockScheduleApi';
import {
  secondsToTime,
  timeToSeconds,
  getCommandTypeLabel,
  getCommandTypeColor,
  formatDaysOfWeek
} from '../../utils/scheduleHelpers';
import { debugLog } from '../../utils/debug';

interface ScheduleLibraryProps {
  siteId: number;
  onLibraryItemSelect?: (item: ScheduleLibraryItem) => void;
  onRequestManageRules?: (item: ScheduleLibraryItem) => void;
}

const ScheduleLibrary: React.FC<ScheduleLibraryProps> = ({
  siteId,
  onRequestManageRules
}) => {
  const [libraryItems, setLibraryItems] = useState<ScheduleLibraryItem[]>([]);
  const [allRules, setAllRules] = useState<ApplicationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ScheduleLibraryItem | null>(null);

  // Expanded/Editing states
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);

  // Form states for create dialog
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCommands, setFormCommands] = useState<ScheduleCommand[]>([]);

  // Inline edit states
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCommands, setEditCommands] = useState<ScheduleCommand[]>([]);

  // Command editing
  const [commandDialogOpen, setCommandDialogOpen] = useState(false);
  const [editingCommandIndex, setEditingCommandIndex] = useState<number | null>(null);
  const [commandHour, setCommandHour] = useState(0);
  const [commandMinute, setCommandMinute] = useState(0);
  const [commandType, setCommandType] = useState<'charge' | 'discharge' | 'trickle_charge'>('charge');
  const [isCommandInlineEdit, setIsCommandInlineEdit] = useState(false);

  // Specific dates viewer
  const [specificDatesDialogOpen, setSpecificDatesDialogOpen] = useState(false);
  const [viewingSpecificDates, setViewingSpecificDates] = useState<string[]>([]);

  useEffect(() => {
    loadLibraryItems();
    loadAllRules();
  }, [siteId]);

  const loadLibraryItems = async () => {
    debugLog('ScheduleLibrary: Loading library items', { siteId });

    setLoading(true);
    setError(null);
    try {
      const items = await getLibraryItems(siteId);
      debugLog('ScheduleLibrary: Library items loaded', {
        count: items.length,
        items: items.map(i => ({ id: i.id, name: i.name, commandCount: i.commands.length }))
      });
      setLibraryItems(items);
    } catch (err) {
      setError('Failed to load library items');
      console.error('Error loading library items:', err);
      debugLog('ScheduleLibrary: Error loading library items', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllRules = async () => {
    debugLog('ScheduleLibrary: Loading application rules', { siteId });

    try {
      const rules = await getAllApplicationRules(siteId);
      debugLog('ScheduleLibrary: Application rules loaded', {
        count: rules.length,
        byType: {
          default: rules.filter(r => r.rule_type === 'default').length,
          dayOfWeek: rules.filter(r => r.rule_type === 'day_of_week').length,
          specificDate: rules.filter(r => r.rule_type === 'specific_date').length
        }
      });
      setAllRules(rules);
    } catch (err) {
      console.error('Error loading rules:', err);
      debugLog('ScheduleLibrary: Error loading rules', err);
    }
  };

  const getRulesForItem = (itemId: number): ApplicationRule[] => {
    return allRules.filter(rule => rule.library_item_id === itemId);
  };

  const getReusableRules = (itemId: number): ApplicationRule[] => {
    const rules = getRulesForItem(itemId);
    return rules.filter(r => r.rule_type === 'default' || r.rule_type === 'day_of_week');
  };

  const handleCreateOpen = () => {
    setFormName('');
    setFormDescription('');
    setFormCommands([]);
    setCreateDialogOpen(true);
  };

  const handleItemClick = (item: ScheduleLibraryItem) => {
    if (editingItemId === item.id) {
      // Already editing, do nothing
      return;
    }
    if (expandedItemId === item.id) {
      // Collapse if already expanded
      setExpandedItemId(null);
    } else {
      // Expand and show commands
      setExpandedItemId(item.id);
    }
  };

  const handleEditClick = (item: ScheduleLibraryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedItemId(item.id);
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditDescription(item.description || '');
    setEditCommands([...item.commands]);
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditName('');
    setEditDescription('');
    setEditCommands([]);
  };

  const handleSaveEdit = async (itemId: number) => {
    if (!editName.trim()) {
      setError('Name is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await updateLibraryItem(itemId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        commands: editCommands
      });
      setEditingItemId(null);
      await loadLibraryItems();
      await loadAllRules();
    } catch (err) {
      setError('Failed to update library item');
      console.error('Error updating library item:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOpen = (item: ScheduleLibraryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  };

  const handleCreateSave = async () => {
    if (!formName.trim()) {
      setError('Name is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createLibraryItem({
        site_id: siteId,
        name: formName.trim(),
        description: formDescription.trim() || null,
        commands: formCommands
      });
      setCreateDialogOpen(false);
      await loadLibraryItems();
    } catch (err) {
      setError('Failed to create library item');
      console.error('Error creating library item:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    setLoading(true);
    setError(null);
    try {
      await deleteLibraryItem(selectedItem.id);
      setDeleteDialogOpen(false);
      setSelectedItem(null);
      await loadLibraryItems();
      await loadAllRules(); // Reload rules since they're deleted with the item
    } catch (err) {
      setError('Failed to delete library item');
      console.error('Error deleting library item:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCommand = (isInlineEdit = false) => {
    setEditingCommandIndex(null);
    setCommandHour(0);
    setCommandMinute(0);
    setCommandType('charge');
    setIsCommandInlineEdit(isInlineEdit);
    setCommandDialogOpen(true);
  };

  const handleEditCommand = (index: number, isInlineEdit = false) => {
    const commands = isInlineEdit ? editCommands : formCommands;
    const command = commands[index];
    setEditingCommandIndex(index);
    setIsCommandInlineEdit(isInlineEdit);
    const hours = Math.floor(command.execution_offset_seconds / 3600);
    const minutes = Math.floor((command.execution_offset_seconds % 3600) / 60);
    setCommandHour(hours);
    setCommandMinute(minutes);
    setCommandType(command.command_type);
    setCommandDialogOpen(true);
  };

  const handleDeleteCommand = (index: number, isInlineEdit = false) => {
    if (isInlineEdit) {
      setEditCommands(editCommands.filter((_, i) => i !== index));
    } else {
      setFormCommands(formCommands.filter((_, i) => i !== index));
    }
  };

  const handleViewSpecificDates = (itemId: number) => {
    const rules = getRulesForItem(itemId);
    const specificDateRules = rules.filter(r => r.rule_type === 'specific_date');
    const allDates = specificDateRules.flatMap(rule => rule.specific_dates || []);
    // Sort dates chronologically
    allDates.sort();
    setViewingSpecificDates(allDates);
    setSpecificDatesDialogOpen(true);
  };

  const handleCommandSave = () => {
    const commands = isCommandInlineEdit ? editCommands : formCommands;
    const setCommands = isCommandInlineEdit ? setEditCommands : setFormCommands;

    const offsetSeconds = timeToSeconds(commandHour, commandMinute);

    // Check for time conflicts (excluding current command if editing)
    const conflict = commands.some((cmd, idx) =>
      idx !== editingCommandIndex && cmd.execution_offset_seconds === offsetSeconds
    );

    if (conflict) {
      setError('A command already exists at this time');
      return;
    }

    const newCommand: ScheduleCommand = {
      id: editingCommandIndex !== null ? commands[editingCommandIndex].id : Date.now(),
      execution_offset_seconds: offsetSeconds,
      command_type: commandType
    };

    if (editingCommandIndex !== null) {
      // Edit existing
      const updated = [...commands];
      updated[editingCommandIndex] = newCommand;
      setCommands(updated.sort((a, b) => a.execution_offset_seconds - b.execution_offset_seconds));
    } else {
      // Add new
      setCommands([...commands, newCommand].sort((a, b) => a.execution_offset_seconds - b.execution_offset_seconds));
    }

    setCommandDialogOpen(false);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">Library</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateOpen}
        >
          New Schedule
        </Button>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && libraryItems.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Library Items List */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <Stack spacing={2}>
          {libraryItems
            .sort((a, b) => {
              // Sort default schedule to top
              const aIsDefault = getRulesForItem(a.id).some(r => r.rule_type === 'default');
              const bIsDefault = getRulesForItem(b.id).some(r => r.rule_type === 'default');
              if (aIsDefault && !bIsDefault) return -1;
              if (!aIsDefault && bIsDefault) return 1;
              return 0;
            })
            .map(item => {
            const rules = getRulesForItem(item.id);
            const reusableRules = getReusableRules(item.id);
            const isDefault = rules.some(r => r.rule_type === 'default');
            const specificDateRules = rules.filter(r => r.rule_type === 'specific_date');
            const specificDateCount = specificDateRules.reduce((sum, rule) => sum + (rule.specific_dates?.length || 0), 0);

            const isExpanded = expandedItemId === item.id;
            const isEditing = editingItemId === item.id;

            return (
              <Card
                key={item.id}
                sx={{
                  cursor: isEditing ? 'default' : 'pointer',
                  '&:hover': isEditing ? {} : { bgcolor: 'action.hover' },
                  border: isDefault ? '2px solid' : '1px solid',
                  borderColor: isDefault ? 'primary.light' : 'divider'
                }}
                onClick={() => !isEditing && handleItemClick(item)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ flexGrow: 1 }}>
                      {isEditing ? (
                        <>
                          <TextField
                            fullWidth
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            label="Name"
                            size="small"
                            sx={{ mb: 1 }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <TextField
                            fullWidth
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            label="Description"
                            size="small"
                            multiline
                            rows={2}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </>
                      ) : (
                        <>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography variant="h6">{item.name}</Typography>
                          </Box>
                          {item.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {item.description}
                            </Typography>
                          )}
                        </>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }} onClick={e => e.stopPropagation()}>
                      {isEditing ? (
                        <>
                          <Button
                            size="small"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleSaveEdit(item.id)}
                            disabled={!editName.trim()}
                          >
                            Save
                          </Button>
                        </>
                      ) : (
                        <>
                          {onRequestManageRules && (
                            <IconButton
                              size="small"
                              onClick={() => onRequestManageRules(item)}
                              title="Manage rules"
                            >
                              <CalendarMonthIcon />
                            </IconButton>
                          )}
                          <IconButton
                            size="small"
                            onClick={(e) => handleEditClick(item, e)}
                            title="Edit"
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={(e) => handleDeleteOpen(item, e)}
                            title="Delete"
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </>
                      )}
                    </Box>
                  </Box>

                  {/* Rules Section */}
                  {(reusableRules.length > 0 || specificDateCount > 0) && (
                    <Box sx={{ mb: 1 }} onClick={e => e.stopPropagation()}>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {reusableRules.map(rule => (
                          <Chip
                            key={rule.id}
                            icon={rule.rule_type === 'default' ? <StarIcon /> : <LoopIcon />}
                            label={
                              rule.rule_type === 'default'
                                ? 'Default'
                                : rule.days_of_week
                                ? formatDaysOfWeek(rule.days_of_week)
                                : ''
                            }
                            size="small"
                            color={rule.rule_type === 'default' ? 'primary' : 'secondary'}
                            variant="outlined"
                          />
                        ))}
                        {specificDateCount > 0 && (
                          <Chip
                            icon={<EventIcon />}
                            label={`${specificDateCount} specific date${specificDateCount !== 1 ? 's' : ''}`}
                            size="small"
                            color="success"
                            variant="outlined"
                            onClick={() => handleViewSpecificDates(item.id)}
                            sx={{ cursor: 'pointer' }}
                          />
                        )}
                      </Box>
                    </Box>
                  )}

                  {!isExpanded && (
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        {item.commands.length} command{item.commands.length !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  )}

                  {/* Expanded Commands Section */}
                  {isExpanded && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }} onClick={e => e.stopPropagation()}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight="bold">Commands</Typography>
                        {isEditing && (
                          <Button
                            startIcon={<AddIcon />}
                            onClick={() => handleAddCommand(true)}
                            size="small"
                          >
                            Add Command
                          </Button>
                        )}
                      </Box>

                      {(isEditing ? editCommands : item.commands).length > 0 ? (
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Time</TableCell>
                                <TableCell>Type</TableCell>
                                {isEditing && <TableCell align="right">Actions</TableCell>}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {(isEditing ? editCommands : item.commands).map((command, index) => (
                                <TableRow key={command.id}>
                                  <TableCell>{secondsToTime(command.execution_offset_seconds)}</TableCell>
                                  <TableCell>
                                    <Chip
                                      label={getCommandTypeLabel(command.command_type)}
                                      color={getCommandTypeColor(command.command_type)}
                                      size="small"
                                    />
                                  </TableCell>
                                  {isEditing && (
                                    <TableCell align="right">
                                      <IconButton size="small" onClick={() => handleEditCommand(index, true)}>
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                      <IconButton size="small" onClick={() => handleDeleteCommand(index, true)} color="error">
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </TableCell>
                                  )}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                          {isEditing ? 'No commands. Click "Add Command" to create one.' : 'No commands configured.'}
                        </Typography>
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {libraryItems.length === 0 && !loading && (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No schedules in library. Click "New Schedule" to create one.
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>

      {/* Create Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create New Schedule</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Name"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              sx={{ mb: 2 }}
              required
            />
            <TextField
              fullWidth
              label="Description"
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              multiline
              rows={2}
              sx={{ mb: 3 }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Commands</Typography>
              <Button
                startIcon={<AddIcon />}
                onClick={() => handleAddCommand(false)}
                size="small"
              >
                Add Command
              </Button>
            </Box>

            {formCommands.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Time</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {formCommands.map((command, index) => (
                      <TableRow key={command.id}>
                        <TableCell>{secondsToTime(command.execution_offset_seconds)}</TableCell>
                        <TableCell>
                          <Chip
                            label={getCommandTypeLabel(command.command_type)}
                            color={getCommandTypeColor(command.command_type)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => handleEditCommand(index)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDeleteCommand(index)} color="error">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                No commands added yet. Click "Add Command" to create one.
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateSave}
            variant="contained"
            disabled={!formName.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Command Add/Edit Dialog */}
      <Dialog
        open={commandDialogOpen}
        onClose={() => setCommandDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingCommandIndex !== null ? 'Edit Command' : 'Add Command'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Hour</InputLabel>
                <Select
                  value={commandHour}
                  label="Hour"
                  onChange={e => setCommandHour(Number(e.target.value))}
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
                  value={commandMinute}
                  label="Minute"
                  onChange={e => setCommandMinute(Number(e.target.value))}
                >
                  {[0, 15, 30, 45].map(m => (
                    <MenuItem key={m} value={m}>
                      {m.toString().padStart(2, '0')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <FormControl fullWidth>
              <InputLabel>Command Type</InputLabel>
              <Select
                value={commandType}
                label="Command Type"
                onChange={e => setCommandType(e.target.value as any)}
              >
                <MenuItem value="charge">Charge</MenuItem>
                <MenuItem value="discharge">Discharge</MenuItem>
                <MenuItem value="trickle_charge">Trickle Charge</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommandDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCommandSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Schedule</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedItem?.name}"?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will also delete all application rules for this schedule.
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Specific Dates Viewer Dialog */}
      <Dialog
        open={specificDatesDialogOpen}
        onClose={() => setSpecificDatesDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Specific Dates</DialogTitle>
        <DialogContent>
          {viewingSpecificDates.length > 0 ? (
            <List>
              {viewingSpecificDates.map((date) => (
                <ListItem key={date}>
                  <ListItemText primary={date} />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              No specific dates configured.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSpecificDatesDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ScheduleLibrary;
