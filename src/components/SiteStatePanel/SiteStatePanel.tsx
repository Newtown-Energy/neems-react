/**
 * Site State Panel.
 *
 * Rich rendering of every [SiteStateIssue] for the selected site,
 * intended for the SLD page where the operational view lives. Each
 * issue lands as a full-width [Alert] with its severity color so a
 * breaker trip or a low SoC reading is obvious at a glance.
 *
 * Renders nothing when there are no issues, so a healthy site adds no
 * visual weight to the SLD layout.
 */

import React, { useMemo } from 'react';
import { Alert, AlertTitle, Stack } from '@mui/material';

import { useSiteContext } from '../../utils/SiteContext';
import { useDemoOverrides } from '../../utils/demoOverrides';
import { evaluateSiteState } from '../../utils/scheduleWarnings';

const SiteStatePanel: React.FC = () => {
  const { selectedSite } = useSiteContext();
  const { overrides } = useDemoOverrides();

  const issues = useMemo(() => {
    if (!selectedSite) return [];
    return evaluateSiteState(selectedSite, {
      currentSocPercent: overrides.currentSocPercent,
      curtailmentCeilingKw: overrides.curtailmentCeilingKw,
      openBreakers: overrides.openBreakers,
      offlineMegapacks: overrides.offlineMegapacks
    });
  }, [selectedSite, overrides]);

  if (issues.length === 0) return null;

  return (
    <Stack spacing={1} sx={{ mb: 2 }}>
      {issues.map(issue => (
        <Alert key={issue.key} severity={issue.severity}>
          <AlertTitle sx={{ textTransform: 'capitalize' }}>
            {issue.key.replace(/-/g, ' ')}
          </AlertTitle>
          {issue.message}
        </Alert>
      ))}
    </Stack>
  );
};

export default SiteStatePanel;
