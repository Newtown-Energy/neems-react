/**
 * Schedule Library Component
 *
 * Displays and manages the library of reusable schedule templates.
 * Each library item can have application rules that determine when it's used.
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import type { ApplicationRule, ScheduleCommandDto, ScheduleLibraryItem } from '@newtown-energy/types';
import {
  createLibraryItem,
  deleteLibraryItem,
  getAllApplicationRules,
  getLibraryItems,
  updateLibraryItem
} from '../../utils/scheduleApi';
import { debugLog, errorLog } from '../../utils/debug';
import CreateScheduleDialog from './CreateScheduleDialog';
import ScheduleItemList from './ScheduleItemList';

interface ScheduleLibraryProps {
  siteId: number;
  onLibraryItemSelect?: (item: ScheduleLibraryItem) => void;
  onRequestManageRules?: (item: ScheduleLibraryItem) => void;
}

const ScheduleLibrary: React.FC<ScheduleLibraryProps> = ({
  siteId,
  onRequestManageRules
}) => {
  const [libraryItems, setLibraryItems] = useState<ScheduleLibraryItem[]>([]);
  const [allRules, setAllRules] = useState<ApplicationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ScheduleLibraryItem | null>(null);

  const [specificDatesDialogOpen, setSpecificDatesDialogOpen] = useState(false);
  const [viewingSpecificDates, setViewingSpecificDates] = useState<string[]>([]);

  useEffect(() => {
    loadLibraryItems();
    loadAllRules();
  }, [siteId]);

  const loadLibraryItems = async () => {
    debugLog('ScheduleLibrary: Loading library items', { siteId });
    setLoading(true);
    setError(null);
    try {
      const items = await getLibraryItems(siteId);
      setLibraryItems(items);
    } catch (err) {
      setError('Failed to load library items');
      errorLog('Error loading library items:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllRules = async () => {
    try {
      const rules = await getAllApplicationRules(siteId);
      setAllRules(rules);
    } catch (err) {
      errorLog('Error loading rules:', err);
    }
  };

  const getRulesForItem = (itemId: number): ApplicationRule[] =>
    allRules.filter(rule => rule.library_item_id === itemId);

  const handleSaveItem = async (
    itemId: number,
    data: { name: string; description: string | null; commands: ScheduleCommandDto[] },
    changeReason: string,
  ) => {
    setLoading(true);
    setError(null);
    try {
      await updateLibraryItem(itemId, { ...data, change_reason: changeReason });
      await loadLibraryItems();
      await loadAllRules();
    } catch (err) {
      setError('Failed to update library item');
      errorLog('Error updating library item:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: {
    name: string;
    description: string | null;
    commands: ScheduleCommandDto[];
  }) => {
    setLoading(true);
    setError(null);
    try {
      await createLibraryItem(siteId, data);
      setCreateDialogOpen(false);
      await loadLibraryItems();
    } catch (err) {
      setError('Failed to create library item');
      errorLog('Error creating library item:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    setLoading(true);
    setError(null);
    try {
      await deleteLibraryItem(selectedItem.id);
      setDeleteDialogOpen(false);
      setSelectedItem(null);
      await loadLibraryItems();
      await loadAllRules();
    } catch (err) {
      setError('Failed to delete library item');
      errorLog('Error deleting library item:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewSpecificDates = (itemId: number) => {
    const rules = getRulesForItem(itemId);
    const specificDateRules = rules.filter(r => r.rule_type === 'specific_date');
    const allDates = specificDateRules.flatMap(rule => rule.specific_dates || []);
    allDates.sort((a, b) => a.localeCompare(b));
    setViewingSpecificDates(allDates);
    setSpecificDatesDialogOpen(true);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">Library</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          New Schedule
        </Button>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && libraryItems.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <ScheduleItemList
          items={libraryItems}
          rulesByItemId={getRulesForItem}
          onSaveItem={handleSaveItem}
          onDeleteItem={(item) => {
            setSelectedItem(item);
            setDeleteDialogOpen(true);
          }}
          onManageRules={onRequestManageRules}
          onViewSpecificDates={handleViewSpecificDates}
          onError={setError}
        />
      </Box>

      <CreateScheduleDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={handleCreate}
        onError={setError}
      />

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Schedule</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedItem?.name}"?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will also delete all application rules for this schedule.
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={specificDatesDialogOpen}
        onClose={() => setSpecificDatesDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Specific Dates</DialogTitle>
        <DialogContent>
          {viewingSpecificDates.length > 0 ? (
            <List>
              {viewingSpecificDates.map((date) => (
                <ListItem key={date}>
                  <ListItemText primary={date} />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              No specific dates configured.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSpecificDatesDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ScheduleLibrary;
