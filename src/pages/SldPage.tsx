import React, { useState } from 'react';
import { Alert, Box } from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SingleLineDiagram from '../components/SingleLineDiagram/SingleLineDiagram';
import type { SldDiagramState } from '../components/SingleLineDiagram/types';
import { useEstop } from '../utils/useEstop';
// DemoControlsDrawer is now mounted at the app level (fixed
// bottom-right) and self-gates to admin roles.

export const pageConfig = {
  id: 'sld',
  title: 'Single Line',
  icon: AccountTreeIcon,
};

const SldPage: React.FC = () => {
  const [diagramState, setDiagramState] = useState<SldDiagramState | null>(null);
  const estop = useEstop();

  // Read from alarm 104 via the alarm feed, not from anything this page did.
  const eStopActive = diagramState?.operationalMode === 'e-stop-active';

  return (
    <Box sx={{ p: 3, overflow: 'auto', flex: 1, minWidth: 0 }}>
      {eStopActive && (
        <Alert severity="error" sx={{ mb: 2 }}>
          E-Stop is active. Line switches are shown as locked out. An E-Stop
          cannot be cleared from this interface — reset it at the panel on
          site, and this will clear once the site reports it.
        </Alert>
      )}

      {/* A request recorded but not yet sent to the site. Deliberately not
          styled as an active E-stop: nothing has tripped until the RTAC says
          so. */}
      {!eStopActive && estop.pending && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          E-Stop requested — sending the signal to the site.
        </Alert>
      )}

      {/* The signal reached the RTAC and the site still reports no trip. The
          ask was delivered, so this is not a failure of this system; it is
          news about the plant, and the operator needs it either way. */}
      {!eStopActive && estop.sentWithoutTrip && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          E-Stop signal sent to the site. The site has
          <strong> not </strong>
          reported a trip. If the plant should have stopped, escalate to on-site
          personnel — this interface cannot stop it.
        </Alert>
      )}

      {estop.failure && !eStopActive && (
        <Alert severity="error" sx={{ mb: 2 }}>
          E-Stop signal could not be delivered: {estop.failure}. The site was
          <strong> never asked </strong>
          and is <strong>not</strong> stopped. Escalate to on-site personnel
          immediately.
        </Alert>
      )}

      {estop.error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={estop.dismissError}>
          {estop.error}
        </Alert>
      )}

      {/* Stale-data, no-data and unreachable-service warnings render once,
          app-wide, via SiteStatePanel, so they're not duplicated here. The
          diagram carries its own flashing frame for the same conditions.
          The emergency/critical alarm bar is deliberately absent on this
          route — the diagram announces it — see [SiteStateBannerSlot]. */}

      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          p: 2,
        }}
      >
        <SingleLineDiagram onStateChange={setDiagramState} estop={estop} />
      </Box>
    </Box>
  );
};

export default SldPage;
