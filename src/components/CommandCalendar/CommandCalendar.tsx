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
  Card,
  CardContent,
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
  Edit as EditIcon
} from '@mui/icons-material';

import type { ScheduleLibraryItem } from '../../utils/mockScheduleApi';
import {
  getEffectiveLibraryItemWithSpecificity
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
      const result = await getEffectiveLibraryItemWithSpecificity(siteId, selectedDate);
      if (result) {
        debugLog('CommandCalendar: Selected date schedule', {
          date: toISODateString(selectedDate),
          schedule: result.item?.name,
          specificity: result.specificity,
          commandCount: result.item?.commands.length
        });
        setSelectedLibraryItem(result.item);
        setSelectedDateSpecificity(result.specificity);
        onDateSelect?.(selectedDate, result.item);
      } else {
        debugLog('CommandCalendar: No schedule for selected date', toISODateString(selectedDate));
        setSelectedLibraryItem(null);
        setSelectedDateSpecificity(-1);
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
                  {/* Date number */}
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

  const renderSelectedDatePanel = () => {
    if (!selectedDate) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Select a date to view details
          </Typography>
        </Box>
      );
    }

    const isPast = isPastDate(selectedDate);

    return (
      <Card>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              {formatScheduleDate(selectedDate)}
            </Typography>
            {isToday(selectedDate) && (
              <Chip label="Today" color="primary" size="small" sx={{ mb: 1 }} />
            )}
            {isPast && (
              <Chip label="Past Date (Read-Only)" color="warning" size="small" sx={{ mb: 1 }} />
            )}
          </Box>

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
                {/* Show rule reason */}
                {getRuleReason() && (
                  <Chip
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

              {/* Actions */}
              {!isPast && (
                <Stack spacing={1}>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => onRequestApplyDifferent?.(selectedDate, selectedLibraryItem)}
                  >
                    Apply Different Schedule
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    fullWidth
                    onClick={() => onRequestEdit?.(selectedDate, selectedLibraryItem)}
                  >
                    Edit Schedule
                  </Button>
                  {/* Cancel override button - would need logic to determine if this is an override */}
                </Stack>
              )}
            </>
          ) : (
            <Box sx={{ py: 2 }}>
              <Alert severity="info">
                No schedule assigned for this date
              </Alert>
              {!isPast && (
                <Button
                  variant="contained"
                  fullWidth
                  sx={{ mt: 2 }}
                  onClick={() => onRequestApplyDifferent?.(selectedDate, null)}
                >
                  Assign Schedule
                </Button>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
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
      <Box sx={{ mb: 2 }}>
        {renderCalendarGrid()}
      </Box>

      {/* Selected Date Panel */}
      <Box>
        {renderSelectedDatePanel()}
      </Box>
    </Box>
  );
};

export default CommandCalendar;
