/**
 * Library Page
 *
 * Manage the library of reusable schedule templates.
 * Create, edit, and delete schedules. Configure application rules.
 */

import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Typography
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  LibraryBooks as LibraryIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import ScheduleLibrary from '../components/ScheduleLibrary';
import ApplicationRuleDialog from '../components/ApplicationRuleDialog';

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

      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" gutterBottom>
          Schedule Library
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Create and manage reusable schedules. Configure when each schedule is applied using rules.
        </Typography>
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
    </Box>
  );
};

export default LibraryPage;
