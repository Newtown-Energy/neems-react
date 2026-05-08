import React from 'react';
import {
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import type { ScheduleCommandDto } from '@newtown-energy/types';
import {
  formatDuration,
  formatSoC,
  getCommandTypeColor,
  getCommandTypeLabel,
  secondsToTime
} from '../../utils/scheduleHelpers';

interface CommandsTableProps {
  commands: ScheduleCommandDto[];
  editable?: boolean;
  onEditCommand?: (index: number) => void;
  onDeleteCommand?: (index: number) => void;
}

const CommandsTable: React.FC<CommandsTableProps> = ({
  commands,
  editable = false,
  onEditCommand,
  onDeleteCommand
}) => (
  <TableContainer component={Paper} variant="outlined">
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Time</TableCell>
          <TableCell>Type</TableCell>
          <TableCell>Duration</TableCell>
          <TableCell>Target SOC</TableCell>
          {editable && <TableCell align="right">Actions</TableCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {commands.map((command, index) => (
          <TableRow key={command.id}>
            <TableCell>{secondsToTime(command.execution_offset_seconds)}</TableCell>
            <TableCell>
              <Chip
                label={getCommandTypeLabel(command.command_type)}
                color={getCommandTypeColor(command.command_type)}
                size="small"
              />
            </TableCell>
            <TableCell>{formatDuration(command.duration_seconds)}</TableCell>
            <TableCell>{formatSoC(command.target_soc_percent)}</TableCell>
            {editable && (
              <TableCell align="right">
                <IconButton size="small" onClick={() => onEditCommand?.(index)}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => onDeleteCommand?.(index)} color="error">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

export default CommandsTable;
