import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Event as EventIcon,
  Loop as LoopIcon,
  Star as StarIcon,
  Stop as StopIcon
} from '@mui/icons-material';
import type { ScheduleCommandDto, ScheduleLibraryItem } from '@newtown-energy/types';
import {
  formatDuration,
  formatScheduleDate,
  formatSoC,
  getCommandTypeColor,
  getCommandTypeLabel,
  isPastDate,
  isToday,
  secondsToTime
} from '../../utils/scheduleHelpers';
import { updateLibraryItem } from '../../utils/scheduleApi';
import { evaluateCommandWarnings } from '../../utils/scheduleWarnings';
import { useSiteContext } from '../../utils/SiteContext';
import { useEffectiveNow } from '../../utils/demoOverrides';
// Site-state context (breakers, megapacks, curtailment, SoC) used to
// thread through here and surface inside the day's warning list. Those
// rows are now site-state issues — see evaluateSiteState — and render
// in the app-wide SiteStatePanel banner + the SLD page.
import { errorLog } from '../../utils/debug';
import CommandEditDialog from '../ScheduleLibrary/CommandEditDialog';
import ReasonPromptDialog from './ReasonPromptDialog';
import ResultingSchedulePane from './ResultingSchedulePane';
import DayChangeHistoryPane from './DayChangeHistoryPane';

export interface ApplicableLibraryItem {
  item: ScheduleLibraryItem;
  specificity: number;
  isActive: boolean;
}

interface DayDetailsDialogProps {
  open: boolean;
  selectedDate: Date | null;
  libraryItem: ScheduleLibraryItem | null;
  specificity: number;
  overrideReason: string | null;
  /** The application rule resolving to this date. Drives the per-day
   *  change-history pane (S2). May be null on unscheduled days. */
  prevailingRuleId: number | null;
  applicableLibraryItems: ApplicableLibraryItem[];
  onClose: () => void;
  onRequestEdit?: (date: Date, item: ScheduleLibraryItem | null) => void;
  onRequestApplyDifferent?: (date: Date, item: ScheduleLibraryItem | null) => void;
  onSwitchToSchedule: (item: ScheduleLibraryItem) => void;
  /**
   * Called after a per-day command edit lands. Parents typically refresh
   * the calendar and re-fetch the day's effective schedule so the new
   * command list shows up in the bar chart and table.
   */
  onCommandsChanged?: () => void;
}

const getRuleReason = (date: Date, specificity: number): string => {
  if (specificity === -1) return '';
  if (specificity === 2) return 'Specific date override';
  if (specificity === 1) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `Day-of-week rule (${dayNames[date.getDay()]})`;
  }
  if (specificity === 0) return 'Default schedule';
  return '';
};

const DayDetailsDialog: React.FC<DayDetailsDialogProps> = ({
  open,
  selectedDate,
  libraryItem,
  specificity,
  overrideReason,
  prevailingRuleId,
  applicableLibraryItems,
  onClose,
  onRequestEdit,
  onRequestApplyDifferent,
  onSwitchToSchedule,
  onCommandsChanged
}) => {
  const { selectedSite } = useSiteContext();
  const effectiveNow = useEffectiveNow();
  const [commandEditTarget, setCommandEditTarget] = useState<ScheduleCommandDto | null>(null);
  const [commandEditOpen, setCommandEditOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sessionDismissed, setSessionDismissed] = useState<Set<string>>(new Set());
  // S1b — collect a reason before any inline command edit lands on the
  // backend. We stash the staged next-commands + a human-readable
  // action label, then ReasonPromptDialog confirms with the reason.
  const [pendingCommit, setPendingCommit] = useState<{
    next: ScheduleCommandDto[];
    title: string;
    description: string;
    confirmLabel: string;
  } | null>(null);

  // Collect warnings across every command on the day so the user sees
  // the full picture without having to open each row individually.
  const dayWarnings = useMemo(() => {
    if (!selectedSite || !libraryItem) return [];
    const all = libraryItem.commands.flatMap(cmd =>
      evaluateCommandWarnings(cmd, selectedSite)
    );
    return all.filter(w => !sessionDismissed.has(w.key));
  }, [libraryItem, selectedSite, sessionDismissed]);

  const handleDismissDayWarning = (key: string) => {
    setSessionDismissed(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  if (!selectedDate) return null;

  const isPast = isPastDate(selectedDate, effectiveNow);
  const ruleReason = getRuleReason(selectedDate, specificity);

  // Per-day inline editing only makes sense when the rule is specific to
  // this date — otherwise the edit would silently fan out to every day
  // the shared library item covers. For shared rules, the user is routed
  // through the existing "Edit Schedule" → clone-or-overwrite flow.
  const canEditCommandsInline = specificity === 2 && !isPast && libraryItem !== null;

  const handleEditCommand = (cmd: ScheduleCommandDto) => {
    setCommandEditTarget(cmd);
    setCommandEditOpen(true);
  };

  const handleAddCommand = () => {
    setCommandEditTarget(null);
    setCommandEditOpen(true);
  };

  const commitCommands = async (next: ScheduleCommandDto[], reason: string) => {
    if (!libraryItem) return;
    setSaveError(null);
    try {
      await updateLibraryItem(libraryItem.id, {
        name: null,
        description: null,
        commands: next.map(c => ({
          execution_offset_seconds: c.execution_offset_seconds,
          command_type: c.command_type,
          duration_seconds: c.duration_seconds ?? null,
          target_soc_percent: c.target_soc_percent ?? null
        })),
        change_reason: reason
      });
      setCommandEditOpen(false);
      onCommandsChanged?.();
    } catch (err) {
      errorLog('DayDetailsDialog: failed to save commands', err);
      setSaveError('Failed to save command — try again');
    }
  };

  const handleSaveCommand = (cmd: ScheduleCommandDto) => {
    if (!libraryItem) return;
    const isEdit = commandEditTarget !== null;
    const next = isEdit
      ? libraryItem.commands.map(c => (c.id === commandEditTarget!.id ? cmd : c))
      : [...libraryItem.commands, cmd];
    next.sort((a, b) => a.execution_offset_seconds - b.execution_offset_seconds);
    setPendingCommit({
      next,
      title: isEdit ? 'Edit command' : 'Add command',
      description: isEdit
        ? 'Why is this command being changed? The reason appears in the per-day change history.'
        : 'Why is this command being added? The reason appears in the per-day change history.',
      confirmLabel: 'Save'
    });
  };

  const handleDeleteCommand = (cmd: ScheduleCommandDto) => {
    if (!libraryItem) return;
    const next = libraryItem.commands.filter(c => c.id !== cmd.id);
    setPendingCommit({
      next,
      title: 'Delete command',
      description:
        'Why is this command being removed? The reason appears in the per-day change history.',
      confirmLabel: 'Delete'
    });
  };

  /**
   * True iff effectiveNow falls inside [start, start+duration) on the
   * selected day. Commands with null/zero duration are never in-flight.
   */
  const isCommandInFlight = (cmd: ScheduleCommandDto): boolean => {
    if (!isToday(selectedDate, effectiveNow)) return false;
    if (cmd.duration_seconds == null || cmd.duration_seconds <= 0) return false;
    const nowSec =
      effectiveNow.getHours() * 3600 +
      effectiveNow.getMinutes() * 60 +
      effectiveNow.getSeconds();
    const start = cmd.execution_offset_seconds;
    return nowSec >= start && nowSec < start + cmd.duration_seconds;
  };

  /**
   * Demo Script v2 Step 4: cancel an in-flight command as-of-NOW. The
   * original command keeps its start time but its duration shrinks to
   * `now - start`; a new trickle_charge command at 0 kW (target_soc 0)
   * runs from `now` to the original end. Both rows audit-trail under
   * the same library-item update.
   *
   * Only available when the rule is a specific-date override (the same
   * gate as inline edit) so the split doesn't fan out to other days.
   */
  const handleCancelAsOfNow = (cmd: ScheduleCommandDto) => {
    if (!libraryItem || cmd.duration_seconds == null) return;
    const nowSec =
      effectiveNow.getHours() * 3600 +
      effectiveNow.getMinutes() * 60 +
      effectiveNow.getSeconds();
    const start = cmd.execution_offset_seconds;
    const end = start + cmd.duration_seconds;
    const newOriginalDuration = nowSec - start;
    const tailDuration = end - nowSec;
    if (newOriginalDuration <= 0 || tailDuration <= 0) return;

    const shrunkOriginal: ScheduleCommandDto = {
      ...cmd,
      duration_seconds: newOriginalDuration
    };
    // 0 kW tail. We don't have a kW field on the command; the demo
    // models "0 kW" as trickle_charge with target_soc_percent = 0 —
    // the bar chart renders it as a thin orange bar but the warning
    // engine and audit row both reflect "scheduled for 0 kW".
    const tail: ScheduleCommandDto = {
      // Negative synthetic id so the type checker / commitCommands map
      // call accepts it; the backend assigns the real id on save.
      id: -Date.now(),
      execution_offset_seconds: nowSec,
      duration_seconds: tailDuration,
      command_type: 'trickle_charge',
      target_soc_percent: 0
    };
    const next = libraryItem.commands
      .map(c => (c.id === cmd.id ? shrunkOriginal : c))
      .concat(tail)
      .sort((a, b) => a.execution_offset_seconds - b.execution_offset_seconds);
    setPendingCommit({
      next,
      title: 'Stop command now',
      description:
        'Why is this command being stopped early? The reason appears in the per-day change history.',
      confirmLabel: 'Stop'
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" component="span">
            {formatScheduleDate(selectedDate)}
          </Typography>
          {isToday(selectedDate, effectiveNow) && <Chip label="Today" color="primary" size="small" />}
          {isPast && <Chip label="Past Date (Read-Only)" color="warning" size="small" />}
        </Box>
      </DialogTitle>
      <DialogContent>
        {libraryItem ? (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Using Schedule:
              </Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>{libraryItem.name}</Typography>
              {libraryItem.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {libraryItem.description}
                </Typography>
              )}
              {ruleReason && (
                <Chip
                  icon={
                    specificity === 2 ? <EventIcon /> :
                      specificity === 1 ? <LoopIcon /> :
                        <StarIcon />
                  }
                  label={ruleReason}
                  size="small"
                  color={
                    specificity === 2 ? 'success' :
                      specificity === 1 ? 'secondary' :
                        'primary'
                  }
                  variant="outlined"
                />
              )}
              {overrideReason && specificity === 2 && (
                <Box sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(76, 175, 80, 0.1)', borderRadius: 1, border: '1px solid', borderColor: 'success.main' }}>
                  <Typography variant="caption" color="success.dark" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                    Override Reason:
                  </Typography>
                  <Typography variant="body2" color="success.dark">
                    {overrideReason}
                  </Typography>
                </Box>
              )}
            </Box>

            <ResultingSchedulePane applicableLibraryItems={applicableLibraryItems} />

            <DayChangeHistoryPane
              ruleId={prevailingRuleId}
              libraryItem={libraryItem ? { id: libraryItem.id, name: libraryItem.name } : null}
              overrideReason={overrideReason}
            />

            {applicableLibraryItems.length > 1 && !isPast && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Overridden Schedules:
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  The following schedules also match this date but are not active:
                </Typography>
                <Stack spacing={1}>
                  {applicableLibraryItems
                    .filter((entry) => !entry.isActive)
                    .map((entry) => (
                      <Box
                        key={entry.item.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          p: 1.5,
                          bgcolor: 'action.hover',
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                          {entry.specificity === 2 ? (
                            <EventIcon fontSize="small" color="success" />
                          ) : entry.specificity === 1 ? (
                            <LoopIcon fontSize="small" color="secondary" />
                          ) : (
                            <StarIcon fontSize="small" color="primary" />
                          )}
                          <Box>
                            <Typography variant="body2">{entry.item.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {entry.item.commands.length} command{entry.item.commands.length !== 1 ? 's' : ''}
                            </Typography>
                          </Box>
                        </Box>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => onSwitchToSchedule(entry.item)}
                        >
                          Apply
                        </Button>
                      </Box>
                    ))}
                </Stack>
              </Box>
            )}

            {dayWarnings.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Warnings</Typography>
                <Stack spacing={1}>
                  {dayWarnings.map(w => (
                    <Alert
                      key={w.key}
                      severity={w.severity}
                      action={
                        w.dismissible ? (
                          <IconButton
                            size="small"
                            color="inherit"
                            onClick={() => handleDismissDayWarning(w.key)}
                            aria-label="Dismiss warning"
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        ) : undefined
                      }
                    >
                      {w.message}
                    </Alert>
                  ))}
                </Stack>
              </Box>
            )}

            {(libraryItem.commands.length > 0 || canEditCommandsInline) && (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2">Commands:</Typography>
                  {canEditCommandsInline && (
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={handleAddCommand}
                    >
                      Add command
                    </Button>
                  )}
                </Box>
                {!canEditCommandsInline && libraryItem.commands.length > 0 && specificity !== 2 && !isPast && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    This day uses a shared schedule. Click <em>Edit Schedule</em> below to make a copy for this date before editing commands.
                  </Typography>
                )}
                {saveError && (
                  <Alert severity="error" onClose={() => setSaveError(null)} sx={{ mb: 1 }}>
                    {saveError}
                  </Alert>
                )}
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Time</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Duration</TableCell>
                        <TableCell>Target SOC</TableCell>
                        {canEditCommandsInline && <TableCell align="right">Actions</TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {libraryItem.commands.map((command) => (
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
                          {canEditCommandsInline && (
                            <TableCell align="right">
                              {isCommandInFlight(command) && (
                                <Tooltip title="Stop this command now: split into the elapsed portion + a 0 kW tail to the original end time">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleCancelAsOfNow(command)}
                                    color="warning"
                                  >
                                    <StopIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Edit command">
                                <IconButton size="small" onClick={() => handleEditCommand(command)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete command">
                                <IconButton size="small" onClick={() => handleDeleteCommand(command)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </>
        ) : (
          <Alert severity="info">
            No schedule assigned for this date
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        {libraryItem ? (
          <>
            {!isPast && (
              <>
                <Button
                  variant="outlined"
                  onClick={() => {
                    onClose();
                    onRequestApplyDifferent?.(selectedDate, libraryItem);
                  }}
                >
                  Apply Different Schedule
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => {
                    onClose();
                    onRequestEdit?.(selectedDate, libraryItem);
                  }}
                >
                  Edit Schedule
                </Button>
              </>
            )}
            <Button onClick={onClose}>Close</Button>
          </>
        ) : (
          <>
            {!isPast && (
              <Button
                variant="contained"
                onClick={() => {
                  onClose();
                  onRequestApplyDifferent?.(selectedDate, null);
                }}
              >
                Assign Schedule
              </Button>
            )}
            <Button onClick={onClose}>Close</Button>
          </>
        )}
      </DialogActions>

      <CommandEditDialog
        open={commandEditOpen}
        initialCommand={commandEditTarget}
        existingCommands={libraryItem?.commands ?? []}
        onSave={handleSaveCommand}
        onClose={() => setCommandEditOpen(false)}
        onError={(message) => setSaveError(message)}
      />

      <ReasonPromptDialog
        open={pendingCommit !== null}
        title={pendingCommit?.title ?? ''}
        description={pendingCommit?.description}
        confirmLabel={pendingCommit?.confirmLabel}
        onCancel={() => setPendingCommit(null)}
        onConfirm={reason => {
          if (pendingCommit) {
            void commitCommands(pendingCommit.next, reason);
            setPendingCommit(null);
          }
        }}
      />
    </Dialog>
  );
};

export default DayDetailsDialog;
