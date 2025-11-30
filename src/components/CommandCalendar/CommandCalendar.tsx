/**
 * Command Calendar Component
 *
 * Month-view calendar showing which library item applies to each day.
 * Includes day detail panel with commands and override actions.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon,
  Edit as EditIcon,
  Event as EventIcon,
  Loop as LoopIcon,
  Star as StarIcon
} from '@mui/icons-material';

import type { ScheduleLibraryItem } from '../../utils/mockScheduleApi';
import {
  getEffectiveLibraryItemWithSpecificity,
  getAllApplicableLibraryItems,
  createApplicationRule
} from '../../utils/mockScheduleApi';
import {
  toISODateString,
  formatScheduleDate,
  isToday,
  isPastDate,
  secondsToTime,
  getCommandTypeLabel,
  getCommandTypeColor
} from '../../utils/scheduleHelpers';
import { debugLog } from '../../utils/debug';

interface CommandCalendarProps {
  siteId: number;
  onDateSelect?: (date: Date, libraryItem: ScheduleLibraryItem | null) => void;
  onRequestEdit?: (date: Date, libraryItem: ScheduleLibraryItem | null) => void;
  onRequestApplyDifferent?: (date: Date, currentLibraryItem: ScheduleLibraryItem | null) => void;
  onRequestCancelOverride?: (date: Date) => void;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CommandCalendar: React.FC<CommandCalendarProps> = ({
  siteId,
  onDateSelect,
  onRequestEdit,
  onRequestApplyDifferent
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<ScheduleLibraryItem | null>(null);
  const [selectedDateSpecificity, setSelectedDateSpecificity] = useState<number>(-1);
  const [allApplicableItems, setAllApplicableItems] = useState<Array<{ item: ScheduleLibraryItem; specificity: number; isActive: boolean }>>([]);
  const [calendarData, setCalendarData] = useState<Map<string, { item: ScheduleLibraryItem | null; specificity: number }>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCalendarMonth();
  }, [siteId, currentMonth]);

  useEffect(() => {
    if (selectedDate) {
      loadSelectedDate();
    }
  }, [selectedDate, siteId]);

  const loadCalendarMonth = async () => {
    debugLog('CommandCalendar: Loading calendar month', {
      year: currentMonth.getFullYear(),
      month: currentMonth.getMonth() + 1,
      siteId
    });

    setLoading(true);
    setError(null);
    try {
      const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      // Get all dates in the month
      const dates: Date[] = [];
      for (let d = 1; d <= lastDay.getDate(); d += 1) {
        dates.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d));
      }

      debugLog('CommandCalendar: Loading schedules for', dates.length, 'dates');

      // Load effective library item for each date with specificity
      const dataMap = new Map<string, { item: ScheduleLibraryItem | null; specificity: number }>();
      for (const date of dates) {
        const result = await getEffectiveLibraryItemWithSpecificity(siteId, date);
        if (result) {
          dataMap.set(toISODateString(date), { item: result.item, specificity: result.specificity });
        } else {
          dataMap.set(toISODateString(date), { item: null, specificity: -1 });
        }
      }

      debugLog('CommandCalendar: Calendar data loaded', {
        totalDates: dataMap.size,
        datesWithSchedules: Array.from(dataMap.values()).filter(d => d.item !== null).length
      });

      setCalendarData(dataMap);
    } catch (err) {
      setError('Failed to load calendar data');
      console.error('Error loading calendar:', err);
      debugLog('CommandCalendar: Error loading calendar', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedDate = async () => {
    if (!selectedDate) return;

    debugLog('CommandCalendar: Loading selected date', toISODateString(selectedDate));

    try {
      // Load the effective schedule
      const result = await getEffectiveLibraryItemWithSpecificity(siteId, selectedDate);

      // Load all applicable schedules (including overridden ones)
      const allItems = await getAllApplicableLibraryItems(siteId, selectedDate);
      setAllApplicableItems(allItems);

      if (result) {
        debugLog('CommandCalendar: Selected date schedule', {
          date: toISODateString(selectedDate),
          schedule: result.item?.name,
          specificity: result.specificity,
          commandCount: result.item?.commands.length,
          totalApplicable: allItems.length
        });
        setSelectedLibraryItem(result.item);
        setSelectedDateSpecificity(result.specificity);
        onDateSelect?.(selectedDate, result.item);
      } else {
        debugLog('CommandCalendar: No schedule for selected date', toISODateString(selectedDate));
        setSelectedLibraryItem(null);
        setSelectedDateSpecificity(-1);
        setAllApplicableItems([]);
        onDateSelect?.(selectedDate, null);
      }
    } catch (err) {
      console.error('Error loading selected date:', err);
      debugLog('CommandCalendar: Error loading selected date', err);
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

  const handleDateClick = (date: Date) => {
    debugLog('CommandCalendar: Date clicked', toISODateString(date));
    setSelectedDate(date);
  };

  const getRuleReason = (): string => {
    if (!selectedDate || selectedDateSpecificity === -1) return '';

    if (selectedDateSpecificity === 2) {
      return 'Specific date override';
    } else if (selectedDateSpecificity === 1) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[selectedDate.getDay()];
      return `Day-of-week rule (${dayName})`;
    } else if (selectedDateSpecificity === 0) {
      return 'Default schedule';
    }
    return '';
  };

  const renderCalendarGrid = () => {
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const startDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startDayOfWeek; i += 1) {
      days.push(null);
    }

    // Add all days of the month
    for (let d = 1; d <= lastDay.getDate(); d += 1) {
      days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d));
    }

    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: '1px solid', borderColor: 'divider' }}>
          {DAYS_OF_WEEK.map(day => (
            <Box key={day} sx={{ p: 1, textAlign: 'center', fontWeight: 'bold', bgcolor: 'grey.100', minWidth: 0 }}>
              <Typography variant="caption">{day}</Typography>
            </Box>
          ))}
        </Box>

        {/* Weeks */}
        {weeks.map((week, weekIdx) => {
          const weekKey = week.find(d => d) ? toISODateString(week.find(d => d)!) : `week-${weekIdx}`;
          return (
            <Box key={weekKey} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {week.map((date, dayIdx) => {
                if (!date) {
                  return <Box key={`empty-${weekKey}-${DAYS_OF_WEEK[dayIdx]}`} sx={{ minHeight: 80, minWidth: 0, borderRight: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }} />;
                }

              const dateKey = toISODateString(date);
              const data = calendarData.get(dateKey);
              const item = data?.item;
              const isSelected = selectedDate && toISODateString(selectedDate) === dateKey;
              const isTodayDate = isToday(date);
              const isPast = isPastDate(date);

              // Determine background color for schedule name based on specificity
              let scheduleNameBgColor = 'transparent';
              if (data?.specificity === 2) {
                // Specific date - green tint
                scheduleNameBgColor = 'rgba(76, 175, 80, 0.15)';
              } else if (data?.specificity === 1) {
                // Day of week - purple tint
                scheduleNameBgColor = 'rgba(156, 39, 176, 0.15)';
              } else if (data?.specificity === 0) {
                // Default - blue tint
                scheduleNameBgColor = 'rgba(25, 118, 210, 0.15)';
              }

              return (
                <Box
                  key={dateKey}
                  onClick={() => handleDateClick(date)}
                  sx={{
                    minHeight: 80,
                    minWidth: 0,
                    p: 0.5,
                    borderRight: '1px solid',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    cursor: 'pointer',
                    bgcolor: isTodayDate ? 'action.hover' : 'background.paper',
                    opacity: isPast ? 0.6 : 1,
                    boxShadow: isSelected ? (theme) => `inset 0 0 0 3px ${theme.palette.primary.main}` : 'none',
                    '&:hover': {
                      bgcolor: 'action.selected'
                    },
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Date number with override icon */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: isTodayDate ? 'bold' : 'normal',
                        color: isTodayDate ? 'primary.main' : 'text.primary'
                      }}
                    >
                      {date.getDate()}
                    </Typography>
                    {/* Schedule type indicator icon */}
                    {data?.specificity === 2 && (
                      <EventIcon
                        sx={{
                          fontSize: 16,
                          color: 'success.main',
                          opacity: 0.8
                        }}
                        titleAccess="Specific date override"
                      />
                    )}
                    {data?.specificity === 1 && (
                      <LoopIcon
                        sx={{
                          fontSize: 16,
                          color: 'secondary.main',
                          opacity: 0.8
                        }}
                        titleAccess="Recurring day-of-week rule"
                      />
                    )}
                    {data?.specificity === 0 && (
                      <StarIcon
                        sx={{
                          fontSize: 16,
                          color: 'primary.main',
                          opacity: 0.6
                        }}
                        titleAccess="Default schedule"
                      />
                    )}
                  </Box>

                  {/* Library item name as pill */}
                  {item && (
                    <Box
                      sx={{
                        display: 'inline-block',
                        bgcolor: scheduleNameBgColor,
                        borderRadius: 1,
                        px: 0.5,
                        py: 0.25
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '0.7rem'
                        }}
                      >
                        {item.name}
                      </Typography>
                    </Box>
                  )}
                </Box>
              );
              })}
            </Box>
          );
        })}
      </Box>
    );
  };

  const handleCloseDetailsModal = () => {
    setSelectedDate(null);
    setSelectedLibraryItem(null);
    setSelectedDateSpecificity(-1);
    setAllApplicableItems([]);
  };

  const handleSwitchToSchedule = async (item: ScheduleLibraryItem) => {
    if (!selectedDate) return;

    try {
      // Create a specific date rule for this schedule
      await createApplicationRule({
        library_item_id: item.id,
        rule_type: 'specific_date',
        days_of_week: null,
        specific_dates: [toISODateString(selectedDate)]
      });

      // Reload the selected date first to show immediate feedback in the modal
      await loadSelectedDate();

      // Then reload the calendar month to update the grid
      await loadCalendarMonth();
    } catch (err) {
      console.error('Error switching to schedule:', err);
      setError('Failed to switch schedule');
    }
  };

  const renderDetailsModal = () => {
    if (!selectedDate) {
      return null;
    }

    const isPast = isPastDate(selectedDate);

    return (
      <Dialog
        open={Boolean(selectedDate)}
        onClose={handleCloseDetailsModal}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="h6" component="span">
              {formatScheduleDate(selectedDate)}
            </Typography>
            {isToday(selectedDate) && (
              <Chip label="Today" color="primary" size="small" />
            )}
            {isPast && (
              <Chip label="Past Date (Read-Only)" color="warning" size="small" />
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedLibraryItem ? (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Using Schedule:
                </Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>{selectedLibraryItem.name}</Typography>
                {selectedLibraryItem.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {selectedLibraryItem.description}
                  </Typography>
                )}
                {/* Show rule reason with icon */}
                {getRuleReason() && (
                  <Chip
                    icon={
                      selectedDateSpecificity === 2 ? <EventIcon /> :
                      selectedDateSpecificity === 1 ? <LoopIcon /> :
                      <StarIcon />
                    }
                    label={getRuleReason()}
                    size="small"
                    color={
                      selectedDateSpecificity === 2 ? 'success' :
                      selectedDateSpecificity === 1 ? 'secondary' :
                      'primary'
                    }
                    variant="outlined"
                  />
                )}
              </Box>

              {/* Commands table */}
              {selectedLibraryItem.commands.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Commands:
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Time</TableCell>
                          <TableCell>Type</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedLibraryItem.commands.map((command) => (
                          <TableRow key={command.id}>
                            <TableCell>{secondsToTime(command.execution_offset_seconds)}</TableCell>
                            <TableCell>
                              <Chip
                                label={getCommandTypeLabel(command.command_type)}
                                color={getCommandTypeColor(command.command_type)}
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* Overridden schedules */}
              {allApplicableItems.length > 1 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Overridden Schedules:
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    These schedules could apply but are overridden by the active schedule
                  </Typography>
                  <Stack spacing={1}>
                    {allApplicableItems
                      .filter(item => !item.isActive)
                      .map((applicableItem) => (
                        <Box
                          key={applicableItem.item.id}
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
                            {applicableItem.specificity === 2 ? (
                              <EventIcon fontSize="small" color="success" />
                            ) : applicableItem.specificity === 1 ? (
                              <LoopIcon fontSize="small" color="secondary" />
                            ) : (
                              <StarIcon fontSize="small" color="primary" />
                            )}
                            <Box>
                              <Typography variant="body2">
                                {applicableItem.item.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {applicableItem.item.commands.length} command{applicableItem.item.commands.length !== 1 ? 's' : ''}
                              </Typography>
                            </Box>
                          </Box>
                          {!isPast && (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleSwitchToSchedule(applicableItem.item)}
                            >
                              Switch
                            </Button>
                          )}
                        </Box>
                      ))}
                  </Stack>
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
          {selectedLibraryItem ? (
            <>
              {!isPast && (
                <>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      handleCloseDetailsModal();
                      onRequestApplyDifferent?.(selectedDate, selectedLibraryItem);
                    }}
                  >
                    Apply Different Schedule
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => {
                      handleCloseDetailsModal();
                      onRequestEdit?.(selectedDate, selectedLibraryItem);
                    }}
                  >
                    Edit Schedule
                  </Button>
                </>
              )}
              <Button onClick={handleCloseDetailsModal}>Close</Button>
            </>
          ) : (
            <>
              {!isPast && (
                <Button
                  variant="contained"
                  onClick={() => {
                    handleCloseDetailsModal();
                    onRequestApplyDifferent?.(selectedDate, null);
                  }}
                >
                  Assign Schedule
                </Button>
              )}
              <Button onClick={handleCloseDetailsModal}>Close</Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={handlePrevMonth} size="small">
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="h5" sx={{ minWidth: 200, textAlign: 'center' }}>
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Typography>
          <IconButton onClick={handleNextMonth} size="small">
            <ChevronRightIcon />
          </IconButton>
        </Box>
        <Button startIcon={<TodayIcon />} onClick={handleToday} size="small">
          Today
        </Button>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && calendarData.size === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Calendar Grid */}
      <Box sx={{ flex: 1 }}>
        {renderCalendarGrid()}
      </Box>

      {/* Day Details Modal */}
      {renderDetailsModal()}
    </Box>
  );
};

export default CommandCalendar;
