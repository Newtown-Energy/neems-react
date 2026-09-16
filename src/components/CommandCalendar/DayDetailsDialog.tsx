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
  Typography
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Event as EventIcon,
  Loop as LoopIcon,
  Star as StarIcon
} from '@mui/icons-material';
import type { ScheduleLibraryItem } from '@newtown-energy/types';
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
import { evaluateCommandWarnings } from '../../utils/scheduleWarnings';
import { useSiteContext } from '../../utils/SiteContext';
import { useEffectiveNow } from '../../utils/demoOverrides';
// Site-state context (breakers, megapacks, curtailment, SoC) used to
// thread through here and surface inside the day's warning list. Those
// rows are now site-state issues — see evaluateSiteState — and render
// in the app-wide SiteStatePanel banner + the SLD page.
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
  onSwitchToSchedule
}) => {
  const { selectedSite } = useSiteContext();
  const effectiveNow = useEffectiveNow();
  const [sessionDismissed, setSessionDismissed] = useState<Set<string>>(new Set());

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

            {libraryItem.commands.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Commands:</Typography>
                {!isPast && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Commands belong to the schedule, not to this day. Click <em>Edit Schedule</em> below to
                    copy it for this date and edit the copy in the Library.
                  </Typography>
                )}
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Time</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Duration</TableCell>
                        <TableCell>Target SOC</TableCell>
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
    </Dialog>
  );
};

export default DayDetailsDialog;
