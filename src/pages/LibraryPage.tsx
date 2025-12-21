/**
 * Library Page
 *
 * Manage the library of reusable schedule templates.
 * Create, edit, and delete schedules. Configure application rules.
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button
} from '@mui/material';
import { LibraryBooks as LibraryIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import ScheduleLibrary from '../components/ScheduleLibrary';
import ApplicationRuleDialog from '../components/ApplicationRuleDialog';

import type { ScheduleLibraryItem } from '../types/generated/ScheduleLibraryItem';

export const pageConfig = {
  id: 'library',
  title: 'Library',
  icon: LibraryIcon
};

const LibraryPage: React.FC = () => {
  const navigate = useNavigate();

  // Hard-coded site ID for MVP
  const HARDCODED_SITE_ID = 1;

  // State
  const [rulesDialogItem, setRulesDialogItem] = useState<ScheduleLibraryItem | null>(null);

  const handleManageRules = (item: ScheduleLibraryItem) => {
    setRulesDialogItem(item);
  };

  const handleRulesDialogClose = () => {
    setRulesDialogItem(null);
  };

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
      <Typography variant="h4" gutterBottom>
        Schedule Library
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
        Create and manage reusable schedules. Configure when each schedule is applied using rules.
      </Typography>

      <Box sx={{ height: 'calc(100% - 100px)' }}>
        <ScheduleLibrary
          siteId={HARDCODED_SITE_ID}
          onRequestManageRules={handleManageRules}
        />
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
