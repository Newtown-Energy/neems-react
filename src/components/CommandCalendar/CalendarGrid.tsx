import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  Event as EventIcon,
  Loop as LoopIcon,
  Star as StarIcon
} from '@mui/icons-material';
import type { CalendarDaySchedule, ScheduleLibraryItem } from '@newtown-energy/types';
import { isPastDate, isToday, toISODateString } from '../../utils/scheduleHelpers';
import { useEffectiveNow } from '../../utils/demoOverrides';
import DayBarChart from './DayBarChart';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SPECIFICITY_BG: Record<number, string> = {
  0: 'rgba(25, 118, 210, 0.15)',
  1: 'rgba(156, 39, 176, 0.15)',
  2: 'rgba(76, 175, 80, 0.15)'
};

interface CalendarGridProps {
  currentMonth: Date;
  calendarData: Map<string, CalendarDaySchedule>;
  /**
   * Library items keyed by `library_item_id`. The grid uses these to draw
   * each day's charge/discharge bars. Passing an empty map is fine —
   * cells will render without bars.
   */
  libraryItemsById: Map<number, ScheduleLibraryItem>;
  selectedDate: Date | null;
  onDateClick: (date: Date) => void;
  sitePowerKw?: number | null;
  /** Charge ceiling as a percentage of `sitePowerKw`. Forwarded to DayBarChart. */
  chargeRatePercent?: number | null;
  /** Discharge ceiling as a percentage of `sitePowerKw`. Forwarded to DayBarChart. */
  dischargeRatePercent?: number | null;
}

const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentMonth,
  calendarData,
  libraryItemsById,
  selectedDate,
  onDateClick,
  sitePowerKw,
  chargeRatePercent,
  dischargeRatePercent
}) => {
  const effectiveNow = useEffectiveNow();
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startDayOfWeek = firstDay.getDay();

  const days: (Date | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i += 1) {
    days.push(null);
  }
  for (let d = 1; d <= lastDay.getDate(); d += 1) {
    days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d));
  }
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: '1px solid', borderColor: 'divider' }}>
        {DAYS_OF_WEEK.map(day => (
          <Box key={day} sx={{ p: 1, textAlign: 'center', fontWeight: 'bold', bgcolor: 'grey.100', minWidth: 0 }}>
            <Typography variant="caption">{day}</Typography>
          </Box>
        ))}
      </Box>

      {weeks.map((week, weekIdx) => {
        const weekKey = week.find(d => d) ? toISODateString(week.find(d => d)!) : `week-${weekIdx}`;
        return (
          <Box key={weekKey} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {week.map((date, dayIdx) => {
              if (!date) {
                return (
                  <Box
                    key={`empty-${weekKey}-${DAYS_OF_WEEK[dayIdx]}`}
                    sx={{ minHeight: 80, minWidth: 0, borderRight: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}
                  />
                );
              }

              const dateKey = toISODateString(date);
              const data = calendarData.get(dateKey);
              const hasSchedule = data && data.library_item_id;
              const isSelected = selectedDate && toISODateString(selectedDate) === dateKey;
              const isTodayDate = isToday(date, effectiveNow);
              const isPast = isPastDate(date, effectiveNow);
              const nowSecondsForCell = isTodayDate
                ? effectiveNow.getHours() * 3600 +
                  effectiveNow.getMinutes() * 60 +
                  effectiveNow.getSeconds()
                : null;

              const scheduleNameBgColor = data?.specificity !== undefined
                ? SPECIFICITY_BG[data.specificity] ?? 'transparent'
                : 'transparent';

              const libraryItem = data ? libraryItemsById.get(data.library_item_id) : undefined;

              return (
                <Box
                  key={dateKey}
                  onClick={() => onDateClick(date)}
                  sx={{
                    minHeight: 110,
                    minWidth: 0,
                    p: 0.5,
                    borderRight: '1px solid',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    cursor: 'pointer',
                    bgcolor: isTodayDate ? 'action.hover' : 'background.paper',
                    opacity: isPast ? 0.6 : 1,
                    boxShadow: isSelected ? (theme) => `inset 0 0 0 3px ${theme.palette.primary.main}` : 'none',
                    '&:hover': { bgcolor: 'action.selected' },
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
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
                    {data?.specificity === 2 && (
                      <EventIcon sx={{ fontSize: 16, color: 'success.main', opacity: 0.8 }} titleAccess="Specific date override" />
                    )}
                    {data?.specificity === 1 && (
                      <LoopIcon sx={{ fontSize: 16, color: 'secondary.main', opacity: 0.8 }} titleAccess="Recurring day-of-week rule" />
                    )}
                    {data?.specificity === 0 && (
                      <StarIcon sx={{ fontSize: 16, color: 'primary.main', opacity: 0.6 }} titleAccess="Default schedule" />
                    )}
                  </Box>

                  {hasSchedule && (
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
                        {data.library_item_name}
                      </Typography>
                    </Box>
                  )}

                  {libraryItem && libraryItem.commands.length > 0 && (
                    <Box sx={{ mt: 'auto', pt: 0.5 }}>
                      <DayBarChart
                        commands={libraryItem.commands}
                        sitePowerKw={sitePowerKw}
                        chargeRatePercent={chargeRatePercent}
                        dischargeRatePercent={dischargeRatePercent}
                        height={28}
                        nowSeconds={nowSecondsForCell}
                      />
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

export default CalendarGrid;
