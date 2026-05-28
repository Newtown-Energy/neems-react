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
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Alert,
  TextField,
  Stack
} from '@mui/material';
import {
  AutoFixHigh as WizardIcon,
  CalendarMonth as CalendarIcon,
  LibraryBooks as LibraryIcon,
  MoreVert as MoreVertIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';

import CommandCalendar from '../components/CommandCalendar';
import EditConfirmationDialog from '../components/EditConfirmationDialog';
import SiteSelector from '../components/SiteSelector/SiteSelector';
import SiteDefaultsPanel, { type SiteDefaultsPanelHandle } from '../components/SiteDefaultsPanel/SiteDefaultsPanel';
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
  const [, setSearchParams] = useSearchParams();
  const { selectedSiteId, selectedSite } = useSiteContext();

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

  // Toolbar overflow menu (Site defaults, Manage Library)
  const [overflowAnchor, setOverflowAnchor] = useState<HTMLElement | null>(null);

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
          <IconButton
            aria-label="More scheduler actions"
            onClick={(e) => setOverflowAnchor(e.currentTarget)}
          >
            <MoreVertIcon />
          </IconButton>
          <Menu
            anchorEl={overflowAnchor}
            open={Boolean(overflowAnchor)}
            onClose={() => setOverflowAnchor(null)}
          >
            <MenuItem
              disabled={!selectedSite}
              onClick={() => {
                setOverflowAnchor(null);
                setDefaultsDialogOpen(true);
              }}
            >
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Site defaults</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                setOverflowAnchor(null);
                navigate('/library');
              }}
            >
              <ListItemIcon>
                <LibraryIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Manage Library</ListItemText>
            </MenuItem>
          </Menu>
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
