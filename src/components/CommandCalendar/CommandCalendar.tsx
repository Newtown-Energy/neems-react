/**
 * Command Calendar Component
 *
 * Month-view calendar showing which library item applies to each day.
 * Includes day detail panel with commands and override actions.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Typography
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon
} from '@mui/icons-material';
import type { CalendarDaySchedule, ScheduleLibraryItem } from '@newtown-energy/types';
import {
  createApplicationRule,
  getAllApplicableLibraryItems,
  getCalendarSchedules,
  getEffectiveSchedule,
  getLibraryItems
} from '../../utils/scheduleApi';
import { toISODateString } from '../../utils/scheduleHelpers';
import { debugLog, errorLog } from '../../utils/debug';
import { useSiteContext } from '../../utils/SiteContext';
import CalendarGrid from './CalendarGrid';
import DayDetailsDialog from './DayDetailsDialog';
import type { ApplicableLibraryItem } from './DayDetailsDialog';
import OverrideReasonDialog from './OverrideReasonDialog';

interface CommandCalendarProps {
  siteId: number;
  onDateSelect?: (date: Date, libraryItem: ScheduleLibraryItem | null) => void;
  onRequestEdit?: (date: Date, libraryItem: ScheduleLibraryItem | null) => void;
  onRequestApplyDifferent?: (date: Date, currentLibraryItem: ScheduleLibraryItem | null) => void;
  onRequestCancelOverride?: (date: Date) => void;
}

const CommandCalendar: React.FC<CommandCalendarProps> = ({
  siteId,
  onDateSelect,
  onRequestEdit,
  onRequestApplyDifferent
}) => {
  const { selectedSite } = useSiteContext();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<ScheduleLibraryItem | null>(null);
  const [selectedDateSpecificity, setSelectedDateSpecificity] = useState<number>(-1);
  const [selectedDateOverrideReason, setSelectedDateOverrideReason] = useState<string | null>(null);
  const [applicableLibraryItems, setApplicableLibraryItems] = useState<ApplicableLibraryItem[]>([]);
  const [calendarData, setCalendarData] = useState<Map<string, CalendarDaySchedule>>(new Map());
  const [libraryItems, setLibraryItems] = useState<ScheduleLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const libraryItemsById = useMemo(() => {
    const map = new Map<number, ScheduleLibraryItem>();
    for (const item of libraryItems) {
      map.set(item.id, item);
    }
    return map;
  }, [libraryItems]);

  const [overrideReasonDialogOpen, setOverrideReasonDialogOpen] = useState(false);
  const [pendingScheduleSwitch, setPendingScheduleSwitch] = useState<ScheduleLibraryItem | null>(null);

  useEffect(() => {
    loadCalendarMonth();
    void loadLibraryItemsForSite();
  }, [siteId, currentMonth]);

  const loadLibraryItemsForSite = async () => {
    try {
      const items = await getLibraryItems(siteId);
      setLibraryItems(items);
    } catch (err) {
      errorLog('CommandCalendar: failed to load library items for bar chart', err);
    }
  };

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
      const calendarSchedules = await getCalendarSchedules(
        siteId,
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1
      );

      const dataMap = new Map<string, CalendarDaySchedule>();
      Object.entries(calendarSchedules).forEach(([dateStr, schedule]) => {
        dataMap.set(dateStr, schedule);
      });
      setCalendarData(dataMap);
    } catch (err) {
      setError('Failed to load calendar data');
      errorLog('Error loading calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedDate = async () => {
    if (!selectedDate) return;

    debugLog('CommandCalendar: Loading selected date', toISODateString(selectedDate));

    try {
      const allApplicable = await getAllApplicableLibraryItems(siteId, selectedDate);
      setApplicableLibraryItems(allApplicable);

      const result = await getEffectiveSchedule(siteId, selectedDate);

      if (result) {
        setSelectedLibraryItem(result.library_item);
        setSelectedDateSpecificity(result.specificity);
        setSelectedDateOverrideReason(result.rule?.override_reason || null);
        onDateSelect?.(selectedDate, result.library_item);
      } else {
        setSelectedLibraryItem(null);
        setSelectedDateSpecificity(-1);
        setSelectedDateOverrideReason(null);
        setApplicableLibraryItems([]);
        onDateSelect?.(selectedDate, null);
      }
    } catch (err) {
      errorLog('Error loading selected date:', err);
    }
  };

  const handleCloseDetailsModal = () => {
    setSelectedDate(null);
    setSelectedLibraryItem(null);
    setSelectedDateSpecificity(-1);
    setSelectedDateOverrideReason(null);
    setApplicableLibraryItems([]);
  };

  const handleSwitchToSchedule = (item: ScheduleLibraryItem) => {
    setPendingScheduleSwitch(item);
    setOverrideReasonDialogOpen(true);
  };

  const handleConfirmScheduleSwitch = async (reason: string) => {
    if (!selectedDate || !pendingScheduleSwitch) return;

    try {
      await createApplicationRule(pendingScheduleSwitch.id, {
        rule_type: 'specific_date',
        days_of_week: null,
        specific_dates: [toISODateString(selectedDate)],
        override_reason: reason.trim() || null
      });

      setOverrideReasonDialogOpen(false);
      setPendingScheduleSwitch(null);

      await loadSelectedDate();
      await loadCalendarMonth();
    } catch (err) {
      errorLog('Error switching to schedule:', err);
      setError('Failed to switch schedule');
    }
  };

  const handleCancelScheduleSwitch = () => {
    setOverrideReasonDialogOpen(false);
    setPendingScheduleSwitch(null);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} size="small">
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="h5" sx={{ minWidth: 200, textAlign: 'center' }}>
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Typography>
          <IconButton onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} size="small">
            <ChevronRightIcon />
          </IconButton>
        </Box>
        <Button
          startIcon={<TodayIcon />}
          onClick={() => {
            const today = new Date();
            setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
            setSelectedDate(today);
          }}
          size="small"
        >
          Today
        </Button>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && calendarData.size === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      <Box sx={{ flex: 1 }}>
        <CalendarGrid
          currentMonth={currentMonth}
          calendarData={calendarData}
          libraryItemsById={libraryItemsById}
          selectedDate={selectedDate}
          onDateClick={setSelectedDate}
          sitePowerKw={selectedSite?.power_kw ?? null}
        />
      </Box>

      <DayDetailsDialog
        open={Boolean(selectedDate)}
        selectedDate={selectedDate}
        libraryItem={selectedLibraryItem}
        specificity={selectedDateSpecificity}
        overrideReason={selectedDateOverrideReason}
        applicableLibraryItems={applicableLibraryItems}
        onClose={handleCloseDetailsModal}
        onRequestEdit={onRequestEdit}
        onRequestApplyDifferent={onRequestApplyDifferent}
        onSwitchToSchedule={handleSwitchToSchedule}
      />

      <OverrideReasonDialog
        open={overrideReasonDialogOpen}
        selectedDate={selectedDate}
        pendingScheduleSwitch={pendingScheduleSwitch}
        onCancel={handleCancelScheduleSwitch}
        onConfirm={handleConfirmScheduleSwitch}
      />
    </Box>
  );
};

export default CommandCalendar;
