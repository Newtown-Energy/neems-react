import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  TextField,
  Typography
} from '@mui/material';
import {
  Add as AddIcon,
  CalendarMonth as CalendarMonthIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Event as EventIcon,
  Loop as LoopIcon,
  Star as StarIcon
} from '@mui/icons-material';
import type {
  ApplicationRule,
  ScheduleCommandDto,
  ScheduleLibraryItem
} from '@newtown-energy/types';
import { formatDaysOfWeek } from '../../utils/scheduleHelpers';
import CommandEditDialog from './CommandEditDialog';
import CommandsTable from './CommandsTable';
import DayChangeHistoryPane from '../CommandCalendar/DayChangeHistoryPane';
import ReasonPromptDialog from '../CommandCalendar/ReasonPromptDialog';

interface ScheduleItemCardProps {
  item: ScheduleLibraryItem;
  rules: ApplicationRule[];
  isDefault: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSave: (
    id: number,
    data: { name: string; description: string | null; commands: ScheduleCommandDto[] },
    changeReason: string,
  ) => Promise<void>;
  onDelete: (item: ScheduleLibraryItem) => void;
  onManageRules?: (item: ScheduleLibraryItem) => void;
  onViewSpecificDates: (itemId: number) => void;
  onError?: (message: string) => void;
}

const ScheduleItemCard: React.FC<ScheduleItemCardProps> = ({
  item,
  rules,
  isDefault,
  isExpanded,
  onToggleExpand,
  onSave,
  onDelete,
  onManageRules,
  onViewSpecificDates,
  onError
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCommands, setEditCommands] = useState<ScheduleCommandDto[]>([]);
  const [commandDialogOpen, setCommandDialogOpen] = useState(false);
  const [editingCommandIndex, setEditingCommandIndex] = useState<number | null>(null);
  // S1c — capture a required reason once per Save click, then persist
  // the staged name/description/commands with it.
  const [reasonPromptOpen, setReasonPromptOpen] = useState(false);

  const reusableRules = isDefault
    ? rules.filter(r => r.rule_type === 'default')
    : rules.filter(r => r.rule_type === 'default' || r.rule_type === 'day_of_week');
  const specificDateRules = rules.filter(r => r.rule_type === 'specific_date');
  const specificDateCount = specificDateRules.reduce(
    (sum, rule) => sum + (rule.specific_dates?.length || 0),
    0
  );

  const handleEnterEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditName(item.name);
    setEditDescription(item.description || '');
    setEditCommands([...item.commands]);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName('');
    setEditDescription('');
    setEditCommands([]);
  };

  const handleSave = () => {
    if (!editName.trim()) {
      onError?.('Name is required');
      return;
    }
    setReasonPromptOpen(true);
  };

  const handleReasonConfirm = async (reason: string) => {
    setReasonPromptOpen(false);
    await onSave(
      item.id,
      {
        name: editName.trim(),
        description: editDescription.trim() || null,
        commands: editCommands,
      },
      reason,
    );
    setIsEditing(false);
  };

  const handleAddCommand = () => {
    setEditingCommandIndex(null);
    setCommandDialogOpen(true);
  };

  const handleEditCommand = (index: number) => {
    setEditingCommandIndex(index);
    setCommandDialogOpen(true);
  };

  const handleDeleteCommand = (index: number) => {
    setEditCommands(editCommands.filter((_, i) => i !== index));
  };

  const handleCommandSave = (command: ScheduleCommandDto) => {
    let next: ScheduleCommandDto[];
    if (editingCommandIndex !== null) {
      next = [...editCommands];
      next[editingCommandIndex] = command;
    } else {
      next = [...editCommands, command];
    }
    next.sort((a, b) => a.execution_offset_seconds - b.execution_offset_seconds);
    setEditCommands(next);
    setCommandDialogOpen(false);
  };

  const handleCardClick = () => {
    if (!isEditing) {
      onToggleExpand();
    }
  };

  const displayCommands = isEditing ? editCommands : item.commands;

  return (
    <Card
      sx={{
        cursor: isEditing ? 'default' : 'pointer',
        '&:hover': isEditing ? {} : { bgcolor: 'action.hover' },
        border: isDefault ? '2px solid' : '1px solid',
        borderColor: isDefault ? 'primary.light' : 'divider'
      }}
      onClick={handleCardClick}
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
                <Button size="small" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleSave}
                  disabled={!editName.trim()}
                >
                  Save
                </Button>
              </>
            ) : (
              <>
                {onManageRules && (
                  <IconButton size="small" onClick={() => onManageRules(item)} title="Manage rules">
                    <CalendarMonthIcon />
                  </IconButton>
                )}
                <IconButton size="small" onClick={handleEnterEdit} title="Edit">
                  <EditIcon />
                </IconButton>
                <IconButton size="small" onClick={() => onDelete(item)} title="Delete" color="error">
                  <DeleteIcon />
                </IconButton>
              </>
            )}
          </Box>
        </Box>

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
                  onClick={() => onViewSpecificDates(item.id)}
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

        {isExpanded && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }} onClick={e => e.stopPropagation()}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold">Commands</Typography>
              {isEditing && (
                <Button startIcon={<AddIcon />} onClick={handleAddCommand} size="small">
                  Add Command
                </Button>
              )}
            </Box>

            {displayCommands.length > 0 ? (
              <CommandsTable
                commands={displayCommands}
                editable={isEditing}
                onEditCommand={handleEditCommand}
                onDeleteCommand={handleDeleteCommand}
              />
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                {isEditing ? 'No commands. Click "Add Command" to create one.' : 'No commands configured.'}
              </Typography>
            )}

            {!isEditing && (
              <Box sx={{ mt: 3 }}>
                <DayChangeHistoryPane
                  ruleId={null}
                  libraryItemId={item.id}
                  overrideReason={null}
                />
              </Box>
            )}
          </Box>
        )}
      </CardContent>

      <CommandEditDialog
        open={commandDialogOpen}
        initialCommand={editingCommandIndex !== null ? editCommands[editingCommandIndex] : null}
        existingCommands={editCommands}
        onSave={handleCommandSave}
        onClose={() => setCommandDialogOpen(false)}
        onError={onError}
      />

      <ReasonPromptDialog
        open={reasonPromptOpen}
        title={`Edit ${item.name}`}
        description="Why is this schedule being changed? The reason appears in the schedule's change history."
        confirmLabel="Save"
        onCancel={() => setReasonPromptOpen(false)}
        onConfirm={handleReasonConfirm}
      />
    </Card>
  );
};

export default ScheduleItemCard;
