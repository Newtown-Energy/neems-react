/**
 * Scheduler Page (Command Calendar)
 *
 * Calendar view showing which schedule applies to each day.
 * Allows applying schedules to specific dates and editing schedules.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Alert
} from '@mui/material';
import { CalendarMonth as CalendarIcon, LibraryBooks as LibraryIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import CommandCalendar from '../components/CommandCalendar';
import EditConfirmationDialog from '../components/EditConfirmationDialog';

import type { ScheduleLibraryItem } from '../utils/mockScheduleApi';
import {
  getLibraryItems,
  cloneLibraryItem,
  createApplicationRule
} from '../utils/mockScheduleApi';
import { toISODateString } from '../utils/scheduleHelpers';

export const pageConfig = {
  id: 'scheduler',
  title: 'Schedule',
  icon: CalendarIcon
};

const SchedulerPage: React.FC = () => {
  const navigate = useNavigate();

  // Hard-coded site ID for MVP
  const HARDCODED_SITE_ID = 1;

  // State
  const [libraryItems, setLibraryItems] = useState<ScheduleLibraryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Edit from calendar flow
  const [editConfirmationOpen, setEditConfirmationOpen] = useState(false);
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [editLibraryItem, setEditLibraryItem] = useState<ScheduleLibraryItem | null>(null);

  // Apply different schedule flow
  const [applyDifferentDialogOpen, setApplyDifferentDialogOpen] = useState(false);
  const [applyDate, setApplyDate] = useState<Date | null>(null);
  const [applyCurrentItem, setApplyCurrentItem] = useState<ScheduleLibraryItem | null>(null);

  // Refresh trigger for calendar
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);

  // Load library items for "apply different" dialog
  useEffect(() => {
    if (applyDifferentDialogOpen || editConfirmationOpen) {
      loadLibraryItems();
    }
  }, [applyDifferentDialogOpen, editConfirmationOpen]);

  const loadLibraryItems = async () => {
    try {
      const items = await getLibraryItems(HARDCODED_SITE_ID);
      setLibraryItems(items);
    } catch (err) {
      console.error('Error loading library items:', err);
    }
  };

  const handleEditFromCalendar = (date: Date, libraryItem: ScheduleLibraryItem | null) => {
    if (!libraryItem) return;
    setEditDate(date);
    setEditLibraryItem(libraryItem);
    setEditConfirmationOpen(true);
  };

  const handleCreateCopy = async (newName: string) => {
    if (!editLibraryItem || !editDate) return;

    try {
      // Clone the library item
      const clonedItem = await cloneLibraryItem(editLibraryItem.id, newName);

      // Create a specific date rule for this date
      await createApplicationRule({
        library_item_id: clonedItem.id,
        rule_type: 'specific_date',
        days_of_week: null,
        specific_dates: [toISODateString(editDate)]
      });

      // Refresh calendar
      setCalendarRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Error creating copy:', err);
    }
  };

  const handleEditOriginal = () => {
    if (!editLibraryItem) return;
    // For now, just show a message that they should go to the Library page
    setError('To edit the original schedule, please go to the Library page.');
  };

  const handleApplyDifferent = (date: Date, currentItem: ScheduleLibraryItem | null) => {
    setApplyDate(date);
    setApplyCurrentItem(currentItem);
    setApplyDifferentDialogOpen(true);
  };

  const handleApplyLibraryItemToDate = async (item: ScheduleLibraryItem) => {
    if (!applyDate) return;

    try {
      // Create a specific date rule for this library item
      await createApplicationRule({
        library_item_id: item.id,
        rule_type: 'specific_date',
        days_of_week: null,
        specific_dates: [toISODateString(applyDate)]
      });

      // Refresh calendar
      setCalendarRefreshKey(prev => prev + 1);
      setApplyDifferentDialogOpen(false);
    } catch (err) {
      console.error('Error applying schedule:', err);
    }
  };

  return (
    <Box sx={{ p: 3, height: 'calc(100vh - 100px)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Schedule Calendar
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View which schedule is applied to each day. Click a day to apply a different schedule or edit.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<LibraryIcon />}
          onClick={() => navigate('/library')}
        >
          Manage Library
        </Button>
      </Box>

      {error && (
        <Alert severity="info" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ height: 'calc(100% - 100px)' }}>
        <CommandCalendar
          key={calendarRefreshKey}
          siteId={HARDCODED_SITE_ID}
          onRequestEdit={handleEditFromCalendar}
          onRequestApplyDifferent={handleApplyDifferent}
        />
      </Box>

      {/* Edit Confirmation Dialog */}
      <EditConfirmationDialog
        open={editConfirmationOpen}
        date={editDate}
        libraryItem={editLibraryItem}
        onClose={() => setEditConfirmationOpen(false)}
        onCreateCopy={handleCreateCopy}
        onEditOriginal={handleEditOriginal}
      />

      {/* Apply Different Schedule Dialog */}
      <Dialog
        open={applyDifferentDialogOpen}
        onClose={() => setApplyDifferentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Apply Schedule to {applyDate && toISODateString(applyDate)}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Select a schedule from the library to apply to this date:
          </Typography>
          <List>
            {libraryItems.map(item => (
              <ListItem key={item.id} disablePadding>
                <ListItemButton
                  onClick={() => handleApplyLibraryItemToDate(item)}
                  selected={item.id === applyCurrentItem?.id}
                >
                  <ListItemText
                    primary={item.name}
                    secondary={`${item.commands.length} command${item.commands.length !== 1 ? 's' : ''}`}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          {libraryItems.length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              No schedules available. Create a schedule in the Library page first.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApplyDifferentDialogOpen(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SchedulerPage;
