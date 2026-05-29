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
import { Add as AddIcon } from '@mui/icons-material';
import type { ScheduleCommandDto } from '@newtown-energy/types';
import CommandEditDialog from './CommandEditDialog';
import CommandsTable from './CommandsTable';

interface CreateScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (
    data: { name: string; description: string | null; commands: ScheduleCommandDto[] },
    changeReason: string,
  ) => Promise<void>;
  onError?: (message: string) => void;
}

const CreateScheduleDialog: React.FC<CreateScheduleDialogProps> = ({
  open,
  onClose,
  onCreate,
  onError
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [commands, setCommands] = useState<ScheduleCommandDto[]>([]);
  // Required so every new schedule lands in the change history with a why.
  const [changeReason, setChangeReason] = useState('');
  const [commandDialogOpen, setCommandDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setCommands([]);
      setChangeReason('');
    }
  }, [open]);

  const handleAddCommand = () => {
    setEditingIndex(null);
    setCommandDialogOpen(true);
  };

  const handleEditCommand = (index: number) => {
    setEditingIndex(index);
    setCommandDialogOpen(true);
  };

  const handleDeleteCommand = (index: number) => {
    setCommands(commands.filter((_, i) => i !== index));
  };

  const handleCommandSave = (command: ScheduleCommandDto) => {
    let next: ScheduleCommandDto[];
    if (editingIndex !== null) {
      next = [...commands];
      next[editingIndex] = command;
    } else {
      next = [...commands, command];
    }
    next.sort((a, b) => a.execution_offset_seconds - b.execution_offset_seconds);
    setCommands(next);
    setCommandDialogOpen(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      onError?.('Name is required');
      return;
    }
    if (!changeReason.trim()) {
      onError?.('A reason for the change is required');
      return;
    }
    await onCreate(
      {
        name: name.trim(),
        description: description.trim() || null,
        commands
      },
      changeReason.trim(),
    );
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Create New Schedule</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Name"
              value={name}
              onChange={e => setName(e.target.value)}
              sx={{ mb: 2 }}
              required
            />
            <TextField
              fullWidth
              label="Description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              multiline
              rows={2}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              required
              label="Reason for change"
              placeholder="e.g., new seasonal schedule, operator request, etc."
              value={changeReason}
              onChange={e => setChangeReason(e.target.value)}
              multiline
              rows={2}
              error={!changeReason.trim()}
              helperText="Required — appears in the schedule's change history."
              sx={{ mb: 3 }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Commands</Typography>
              <Button startIcon={<AddIcon />} onClick={handleAddCommand} size="small">
                Add Command
              </Button>
            </Box>

            {commands.length > 0 ? (
              <CommandsTable
                commands={commands}
                editable
                onEditCommand={handleEditCommand}
                onDeleteCommand={handleDeleteCommand}
              />
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                No commands added yet. Click "Add Command" to create one.
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!name.trim() || !changeReason.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <CommandEditDialog
        open={commandDialogOpen}
        initialCommand={editingIndex !== null ? commands[editingIndex] : null}
        existingCommands={commands}
        onSave={handleCommandSave}
        onClose={() => setCommandDialogOpen(false)}
        onError={onError}
      />
    </>
  );
};

export default CreateScheduleDialog;
