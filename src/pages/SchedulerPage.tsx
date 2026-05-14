/**
 * Scheduler Page (Command Calendar)
 *
 * Calendar view showing which schedule applies to each day.
 * Allows applying schedules to specific dates and editing schedules.
 */

import React, { useRef, useState, useEffect } from 'react';
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
  LibraryBooks as LibraryIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';

import CommandCalendar from '../components/CommandCalendar';
import EditConfirmationDialog from '../components/EditConfirmationDialog';
import SiteSelector from '../components/SiteSelector/SiteSelector';
import SiteDefaultsPanel, { type SiteDefaultsPanelHandle } from '../components/SiteDefaultsPanel/SiteDefaultsPanel';
import PeakSeasonWizard from '../components/PeakSeasonWizard/PeakSeasonWizard';
import DemoControlsDrawer from '../components/DemoControlsDrawer/DemoControlsDrawer';
import { useAuth } from './LoginPage/useAuth';

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

const ADMIN_ROLES = ['admin', 'newtown-admin', 'newtown-staff'];

const SchedulerPage: React.FC = () => {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { selectedSiteId, selectedSite } = useSiteContext();
  const { userInfo } = useAuth();
  const isAdmin = userInfo?.roles?.some(r => ADMIN_ROLES.includes(r)) ?? false;

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
  const [applyOverrideReason, setApplyOverrideReason] = useState('');

  // Refresh trigger for calendar
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);

  // Site defaults dialog
  const [defaultsDialogOpen, setDefaultsDialogOpen] = useState(false);
  const [defaultsSaving, setDefaultsSaving] = useState(false);
  const defaultsPanelRef = useRef<SiteDefaultsPanelHandle>(null);

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
        override_reason: null
      });

      // Re-open the day details dialog on the newly-cloned schedule.
      // The "Edit Schedule" path closed the day dialog (stripping `d`
      // from the URL); we put it back so the calendar remount lands
      // the user inline-editing the new specific-date copy instead of
      // making them click the day again.
      const dateStr = toISODateString(editDate);
      const monthStr = `${editDate.getFullYear()}-${(editDate.getMonth() + 1)
        .toString()
        .padStart(2, '0')}`;
      setSearchParams(prev => {
        const params = new URLSearchParams(prev);
        params.set('d', dateStr);
        params.set('m', monthStr);
        return params;
      });

      // Refresh calendar
      setCalendarRefreshKey(prev => prev + 1);
    } catch (err) {
      errorLog('Error creating copy:', err);
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
    setApplyOverrideReason('');
    setApplyDifferentDialogOpen(true);
  };

  const handleApplyLibraryItemToDate = async (item: ScheduleLibraryItem) => {
    if (!applyDate) return;

    try {
      // Create a specific date rule for this library item with optional reason
      await createApplicationRule(item.id, {
        rule_type: 'specific_date',
        days_of_week: null,
        specific_dates: [toISODateString(applyDate)],
        override_reason: applyOverrideReason.trim() || null
      });

      // Refresh calendar
      setCalendarRefreshKey(prev => prev + 1);
      setApplyDifferentDialogOpen(false);
      setApplyOverrideReason('');
    } catch (err) {
      errorLog('Error applying schedule:', err);
    }
  };

  const closedLoopOff = selectedSite !== null && !selectedSite.closed_loop_enabled;

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
          <SiteSelector />
          <Button
            variant="contained"
            startIcon={<WizardIcon />}
            onClick={() => setWizardOpen(true)}
            disabled={!selectedSite}
          >
            Peak-season wizard
          </Button>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setDefaultsDialogOpen(true)}
            disabled={!selectedSite}
          >
            Site defaults
          </Button>
          <Button
            variant="outlined"
            startIcon={<LibraryIcon />}
            onClick={() => navigate('/library')}
          >
            Manage Library
          </Button>
          {isAdmin && <DemoControlsDrawer />}
        </Stack>
      </Box>

      {closedLoopOff && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Closed-loop control is disabled for this site — schedules will be visualized but not enforced.
        </Alert>
      )}

      {error && (
        <Alert severity="info" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
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

      <Dialog
        open={defaultsDialogOpen}
        onClose={() => setDefaultsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Site defaults{selectedSite ? ` — ${selectedSite.name}` : ''}
        </DialogTitle>
        <DialogContent dividers>
          <SiteDefaultsPanel ref={defaultsPanelRef} onSavingChange={setDefaultsSaving} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDefaultsDialogOpen(false)} disabled={defaultsSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={defaultsSaving || !selectedSite}
            onClick={async () => {
              const ok = await defaultsPanelRef.current?.save();
              if (ok) setDefaultsDialogOpen(false);
            }}
          >
            {defaultsSaving ? 'Saving…' : 'Save defaults'}
          </Button>
        </DialogActions>
      </Dialog>

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
          <Box sx={{ mt: 3 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Override Reason (optional)"
              placeholder="e.g., Holiday, special event, maintenance, etc."
              value={applyOverrideReason}
              onChange={(e) => setApplyOverrideReason(e.target.value)}
              helperText="Explain why this date uses a different schedule"
            />
          </Box>
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
