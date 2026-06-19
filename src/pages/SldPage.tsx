import React, { useState } from 'react';
import {
  Alert,
  Box,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SingleLineDiagram from '../components/SingleLineDiagram/SingleLineDiagram';
import type { SldDiagramState } from '../components/SingleLineDiagram/types';
// DemoControlsDrawer is now mounted at the app level (fixed
// bottom-right) and self-gates to admin roles.

export const pageConfig = {
  id: 'sld',
  title: 'Single Line',
  icon: AccountTreeIcon,
};

// Site identity is intentionally abstracted with placeholder values so the SLD
// can be shown/demoed without revealing the real site, address, or the
// utility/developer involved. Replace with real values only in a private build.
const PROJECT_INFO = {
  name: 'Demo BESS 1A',
  address: '123 Example St, Anytown, NY 10001',
  codDate: 'June 2026',
  bessRating: '5 MW / 23.5 MWh',
  utilityProjectCode: '—',
  developerProjectNumber: '—',
};

const ProjectInfoCard: React.FC = () => (
  <Paper
    variant="outlined"
    sx={{ p: 2, minWidth: 260, alignSelf: 'flex-start' }}
  >
    <Typography variant="subtitle2" gutterBottom>
      Project Info: {PROJECT_INFO.name}
    </Typography>
    <Stack spacing={0.5}>
      <InfoLine label="Address" value={PROJECT_INFO.address} />
      <InfoLine label="COD Date" value={PROJECT_INFO.codDate} />
      <InfoLine label="BESS Rating" value={PROJECT_INFO.bessRating} />
      <InfoLine label="Utility Project Code" value={PROJECT_INFO.utilityProjectCode} />
      <InfoLine label="Developer Project #" value={PROJECT_INFO.developerProjectNumber} />
    </Stack>
  </Paper>
);

const InfoLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Typography variant="caption" component="div" color="text.secondary">
    <strong>{label}:</strong> {value}
  </Typography>
);

const SldPage: React.FC = () => {
  const [diagramState, setDiagramState] = useState<SldDiagramState | null>(null);

  const noData =
    diagramState != null &&
    !diagramState.dataStale &&
    diagramState.lastAlarmUpdate == null;
  const eStopActive = diagramState?.operationalMode === 'e-stop-active';

  return (
    <Box sx={{ p: 3, overflow: 'auto', flex: 1, minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems="flex-start"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h2" gutterBottom>
            Single Line
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {PROJECT_INFO.name} — click a line switch (89L-1/89L-2) or feeder
            breaker to toggle its position. Use the red E-STOP button for a
            confirmed site-wide lockout.
          </Typography>
        </Box>
        <ProjectInfoCard />
      </Stack>

      {eStopActive && (
        <Alert severity="error" sx={{ mb: 2 }}>
          E-Stop is active. Line switches are shown as locked out. Press
          "Remove E-Stop" on the diagram to return to normal operation.
        </Alert>
      )}

      {/* Stale-data and unreachable-service warnings now render once,
          app-wide, via SiteStatePanel, so they're not duplicated here. */}

      {noData && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No alarm data available yet. The diagram shows default (normal) state.
        </Alert>
      )}

      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          p: 2,
        }}
      >
        <SingleLineDiagram onStateChange={setDiagramState} />
      </Box>
    </Box>
  );
};

export default SldPage;
