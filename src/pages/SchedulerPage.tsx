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
  Alert,
  TextField,
  Stack
} from '@mui/material';
import {
  AutoFixHigh as WizardIcon,
  CalendarMonth as CalendarIcon,
  LibraryBooks as LibraryIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import CommandCalendar from '../components/CommandCalendar';
import EditConfirmationDialog from '../components/EditConfirmationDialog';
import PeakSeasonWizard from '../components/PeakSeasonWizard/PeakSeasonWizard';
// DemoControlsDrawer is now mounted at the app level and self-gates
// to admin roles — no per-page wiring needed.

import type { ScheduleLibraryItem } from '@newtown-energy/types';
import {
  getLibraryItems,
  cloneLibraryItem,
  createApplicationRule
} from '../utils/scheduleApi';
import { errorLog } from '../utils/debug';
import { toISODateString } from '../utils/scheduleHelpers';
import { useSiteContext } from '../utils/SiteContext';

export const pageConfig = {
  id: 'scheduler',
  title: 'Schedule',
  icon: CalendarIcon
};

const SchedulerPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedSiteId, selectedSite } = useSiteContext();

  // State
  const [libraryItems, setLibraryItems] = useState<ScheduleLibraryItem[]>([]);

  // Edit from calendar flow
  const [editConfirmationOpen, setEditConfirmationOpen] = useState(false);
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [editLibraryItem, setEditLibraryItem] = useState<ScheduleLibraryItem | null>(null);

  // Apply different schedule flow
  const [applyDifferentDialogOpen, setApplyDifferentDialogOpen] = useState(false);
  const [applyDate, setApplyDate] = useState<Date | null>(null);
  const [applyCurrentItem, setApplyCurrentItem] = useState<ScheduleLibraryItem | null>(null);
  const [applyOverrideReason, setApplyOverrideReason] = useState('');

  // Refresh trigger for calendar
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);

  // Peak-season wizard
  const [wizardOpen, setWizardOpen] = useState(false);

  // Load library items for "apply different" dialog
  useEffect(() => {
    if ((applyDifferentDialogOpen || editConfirmationOpen) && selectedSiteId !== null) {
      void loadLibraryItems(selectedSiteId);
    }
  }, [applyDifferentDialogOpen, editConfirmationOpen, selectedSiteId]);

  const loadLibraryItems = async (siteId: number) => {
    try {
      const items = await getLibraryItems(siteId);
      setLibraryItems(items);
    } catch (err) {
      errorLog('Error loading library items:', err);
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
      const clonedItem = await cloneLibraryItem(editLibraryItem.id, { name: newName, description: null });

      // Create a specific date rule for this date
      await createApplicationRule(clonedItem.id, {
        rule_type: 'specific_date',
        days_of_week: null,
        specific_dates: [toISODateString(editDate)],
        override_reason: null,
        change_reason: null
      });

      // The copy exists and is applied, but nothing has been edited yet —
      // land the user on its card in the Library, open for editing. Same
      // destination as "Edit the original schedule"; the day dialog is a
      // read-only view and has nowhere to edit commands.
      navigate(`/library?edit=${clonedItem.id}`);
    } catch (err) {
      errorLog('Error creating copy:', err);
    }
  };

  const handleEditOriginal = () => {
    if (!editLibraryItem) return;
    // Shared schedules are edited in the Library, which already handles
    // the reason prompt and the save. Land the user on that schedule's
    // card with its editor open.
    navigate(`/library?edit=${editLibraryItem.id}`);
  };

  const handleApplyDifferent = (date: Date, currentItem: ScheduleLibraryItem | null) => {
    setApplyDate(date);
    setApplyCurrentItem(currentItem);
    setApplyOverrideReason('');
    setApplyDifferentDialogOpen(true);
  };

  const handleApplyLibraryItemToDate = async (item: ScheduleLibraryItem) => {
    if (!applyDate) return;
    // Reason is required (S1 demo follow-up). Defensive guard in case
    // a future caller wires up the action without the dialog gating.
    if (applyOverrideReason.trim().length === 0) return;

    try {
      await createApplicationRule(item.id, {
        rule_type: 'specific_date',
        days_of_week: null,
        specific_dates: [toISODateString(applyDate)],
        // Mirror the reason into change_reason so the activity row
        // also carries it; DayChangeHistoryPane prefers change_reason
        // and falls back to override_reason if absent.
        override_reason: applyOverrideReason.trim(),
        change_reason: applyOverrideReason.trim()
      });

      setCalendarRefreshKey(prev => prev + 1);
      setApplyDifferentDialogOpen(false);
      setApplyOverrideReason('');
    } catch (err) {
      errorLog('Error applying schedule:', err);
    }
  };

  const closedLoopOff = selectedSite !== null && !selectedSite.closed_loop_enabled;

  // The wizard is onboarding, offered once. Running it again would
  // overwrite the site's settings on its way to failing on the schedule
  // name it already used (#147). Settings stay editable on Site Settings,
  // schedules in the Library.
  const wizardAlreadyRun =
    selectedSite !== null && selectedSite.site_configuration_wizard_completed_at !== null;

  return (
    <Box sx={{ p: 3, height: 'calc(100vh - 100px)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Schedule Calendar
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View which schedule is applied to each day. Click a day to apply a different schedule or edit.
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          {!wizardAlreadyRun && (
            <Button
              variant="contained"
              startIcon={<WizardIcon />}
              onClick={() => setWizardOpen(true)}
              disabled={!selectedSite}
            >
              Site configuration wizard
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<LibraryIcon />}
            onClick={() => navigate('/library')}
          >
            Manage Library
          </Button>
        </Stack>
      </Box>

      {closedLoopOff && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Closed-loop control is disabled for this site — schedules will be visualized but not enforced.
        </Alert>
      )}

      <Box sx={{ height: 'calc(100% - 140px)' }}>
        {selectedSiteId === null ? (
          <Alert severity="info">No site available. Ask an admin to add one in the Admin panel.</Alert>
        ) : (
          <CommandCalendar
            key={`${selectedSiteId}-${calendarRefreshKey}`}
            siteId={selectedSiteId}
            onRequestEdit={handleEditFromCalendar}
            onRequestApplyDifferent={handleApplyDifferent}
          />
        )}
      </Box>

      <PeakSeasonWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={() => setCalendarRefreshKey(prev => prev + 1)}
      />


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
            Provide a reason, then pick a schedule from the library. The
            reason appears in this day's change history.
          </Typography>
          <Box sx={{ mt: 1, mb: 3 }}>
            <TextField
              fullWidth
              required
              multiline
              rows={3}
              label="Override reason"
              placeholder="e.g., Holiday, special event, maintenance, etc."
              value={applyOverrideReason}
              onChange={(e) => setApplyOverrideReason(e.target.value)}
              helperText="Required — schedules cannot be applied without a reason."
              error={applyOverrideReason.trim().length === 0}
            />
          </Box>
          <List>
            {libraryItems.map(item => {
              const disabled = applyOverrideReason.trim().length === 0;
              return (
                <ListItem key={item.id} disablePadding>
                  <ListItemButton
                    onClick={() => handleApplyLibraryItemToDate(item)}
                    selected={item.id === applyCurrentItem?.id}
                    disabled={disabled}
                  >
                    <ListItemText
                      primary={item.name}
                      secondary={`${item.commands.length} command${item.commands.length !== 1 ? 's' : ''}`}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
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
