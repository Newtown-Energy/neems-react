/**
 * Site Settings Page
 *
 * Edit the per-site defaults that drive scheduling, command sizing,
 * and tariff windows. Hosts the [SiteDefaultsPanel] (the historical
 * name of the underlying form — kept to avoid churn in shared types).
 */

import React, { useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';

import SiteDefaultsPanel, {
  type SiteDefaultsPanelHandle,
} from '../components/SiteDefaultsPanel/SiteDefaultsPanel';
import { useSiteContext } from '../utils/SiteContext';

export const pageConfig = {
  id: 'site-settings',
  title: 'Site Settings',
  icon: SettingsIcon,
};

const SiteSettingsPage: React.FC = () => {
  const { selectedSite } = useSiteContext();
  const panelRef = useRef<SiteDefaultsPanelHandle>(null);
  const [saving, setSaving] = useState(false);

  return (
    <Box sx={{ p: 3, height: 'calc(100vh - 100px)', overflow: 'auto' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h4" gutterBottom>
            Site Settings{selectedSite ? ` — ${selectedSite.name}` : ''}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Per-site defaults used by the scheduler and battery commands.
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            variant="contained"
            disabled={saving || !selectedSite}
            onClick={() => {
              void panelRef.current?.save();
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Stack>
      </Box>

      {!selectedSite ? (
        <Alert severity="info">No site available. Ask an admin to add one in the Admin panel.</Alert>
      ) : (
        <SiteDefaultsPanel ref={panelRef} onSavingChange={setSaving} />
      )}
    </Box>
  );
};

export default SiteSettingsPage;
