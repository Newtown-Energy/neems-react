/**
 * Curtailment indicator badge for the Single-Line Diagram.
 *
 * Demo Script v2 asks for a small overlay near the interconnection that
 * reads "Running at curtailment limit — output capped at NNN kW" while
 * curtailment is in effect. The badge reads its value from
 * `useDemoOverrides().overrides.curtailmentCeilingKw` and only renders
 * when the ceiling is set *and* below the site's `power_kw` (a ceiling
 * at or above site power means no real curtailment).
 *
 * Sits in the top-right corner of the SLD container — outside the
 * pan/zoom viewer so it doesn't move when the operator zooms.
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { Bolt as BoltIcon } from '@mui/icons-material';

import { useDemoOverrides } from '../../utils/demoOverrides';
import { useSiteContext } from '../../utils/SiteContext';

const CurtailmentBadge: React.FC = () => {
  const { overrides } = useDemoOverrides();
  const { selectedSite } = useSiteContext();

  const ceiling = overrides.curtailmentCeilingKw;
  const sitePower = selectedSite?.power_kw ?? null;

  // No override → nothing to draw. A ceiling at or above the site's
  // power is also a no-op (utility is not actually curtailing us).
  if (ceiling == null) return null;
  if (sitePower != null && ceiling >= sitePower) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.5,
        py: 0.75,
        bgcolor: 'warning.main',
        color: 'warning.contrastText',
        borderRadius: 1,
        boxShadow: 2,
        maxWidth: 280
      }}
      role="status"
      aria-label="Curtailment limit active"
    >
      <BoltIcon fontSize="small" />
      <Typography variant="caption" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
        Running at curtailment limit — output capped at {Math.round(ceiling)} kW
      </Typography>
    </Box>
  );
};

export default CurtailmentBadge;
