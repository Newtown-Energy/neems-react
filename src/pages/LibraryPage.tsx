/**
 * Library Page
 *
 * Manage the library of reusable schedule templates.
 * Create, edit, and delete schedules. Configure application rules.
 */

import React, { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  LibraryBooks as LibraryIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import ScheduleLibrary from '../components/ScheduleLibrary';
import ApplicationRuleDialog from '../components/ApplicationRuleDialog';
import SiteDefaultsPanel, { type SiteDefaultsPanelHandle } from '../components/SiteDefaultsPanel/SiteDefaultsPanel';

import { useSiteContext } from '../utils/SiteContext';

import type { ScheduleLibraryItem } from '@newtown-energy/types';

export const pageConfig = {
  id: 'library',
  title: 'Library',
  icon: LibraryIcon
};

const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedSiteId, selectedSite } = useSiteContext();

  const [rulesDialogItem, setRulesDialogItem] = useState<ScheduleLibraryItem | null>(null);
  const [defaultsDialogOpen, setDefaultsDialogOpen] = useState(false);
  const [defaultsSaving, setDefaultsSaving] = useState(false);
  const defaultsPanelRef = useRef<SiteDefaultsPanelHandle>(null);

  const handleManageRules = (item: ScheduleLibraryItem) => {
    setRulesDialogItem(item);
  };

  const handleRulesDialogClose = () => {
    setRulesDialogItem(null);
  };

  const closedLoopOff = selectedSite !== null && !selectedSite.closed_loop_enabled;

  return (
    <Box sx={{ p: 3, height: 'calc(100vh - 100px)' }}>
      <Box sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/scheduler')}
          sx={{ mb: 2 }}
        >
          Back to Calendar
        </Button>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Schedule Library
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create and manage reusable schedules. Configure when each schedule is applied using rules.
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setDefaultsDialogOpen(true)}
            disabled={!selectedSite}
          >
            Site defaults
          </Button>
        </Stack>
      </Box>

      {closedLoopOff && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Closed-loop control is disabled for this site — schedules will be visualized but not enforced.
        </Alert>
      )}

      <Box sx={{ height: 'calc(100% - 160px)' }}>
        {selectedSiteId === null ? (
          <Alert severity="info">No site available.</Alert>
        ) : (
          <ScheduleLibrary
            siteId={selectedSiteId}
            onRequestManageRules={handleManageRules}
          />
        )}
      </Box>

      {/* Application Rules Dialog */}
      <ApplicationRuleDialog
        open={!!rulesDialogItem}
        libraryItem={rulesDialogItem}
        onClose={handleRulesDialogClose}
      />

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
    </Box>
  );
};

export default LibraryPage;
