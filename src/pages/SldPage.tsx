import React, { useState } from 'react';
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SingleLineDiagram from '../components/SingleLineDiagram/SingleLineDiagram';
import type { SldDiagramState } from '../components/SingleLineDiagram/types';

export const pageConfig = {
  id: 'sld',
  title: 'Single Line Diagram',
  icon: AccountTreeIcon,
};

const STALE_THRESHOLD_SECONDS = 60;

const SldPage: React.FC = () => {
  const [diagramState, setDiagramState] = useState<SldDiagramState | null>(null);

  const isStale =
    diagramState?.dataStale ||
    (diagramState?.dataAgeSeconds != null &&
      diagramState.dataAgeSeconds > STALE_THRESHOLD_SECONDS);
  const noData =
    diagramState != null &&
    !diagramState.dataStale &&
    diagramState.lastAlarmUpdate == null;

  return (
    <Box sx={{ p: 3, overflow: 'auto', flex: 1 }}>
      <Typography variant="h2" gutterBottom>
        Single Line Diagram
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Newtown BESS Facility — Electrical Single Line Diagram.
        Click circuit breakers to toggle open/closed state.
      </Typography>

      {/* Stale data warning */}
      {isStale && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {diagramState?.dataStale
            ? 'Unable to reach the alarm service. Displayed state may be outdated.'
            : `Alarm data is ${diagramState?.dataAgeSeconds} seconds old. The RTAC connection may be down.`}
        </Alert>
      )}

      {/* No data info */}
      {noData && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No alarm data available yet. The diagram shows default (normal) state.
        </Alert>
      )}

      {/* Legend */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Chip label="Normal" size="small" variant="outlined" />
        <Chip label="Warning" size="small" color="info" />
        <Chip label="Critical" size="small" color="warning" />
        <Chip label="Emergency" size="small" color="error" />
      </Stack>

      {/* Diagram */}
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
