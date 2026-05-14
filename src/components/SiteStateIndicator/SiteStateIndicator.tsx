/**
 * Site State Indicator.
 *
 * App-wide chip that surfaces a count of active [SiteStateIssue] rows
 * for the currently-selected site. Renders nothing when there are no
 * issues, so a healthy site adds zero visual weight.
 *
 * The chip links to `/sld`, which hosts the full [SiteStatePanel] with
 * each issue's message. The peripheral cue lets the operator notice a
 * breaker trip or low SoC without leaving the schedule workflow.
 *
 * Mount inside the routes so it has access to the site + demo-overrides
 * contexts, but outside any individual page's chrome so it persists
 * across navigation.
 */

import React, { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Chip, Tooltip } from '@mui/material';
import { Warning as WarningIcon, Error as ErrorIcon } from '@mui/icons-material';

import { useSiteContext } from '../../utils/SiteContext';
import { useDemoOverrides } from '../../utils/demoOverrides';
import {
  evaluateSiteState,
  type WarningSeverity
} from '../../utils/scheduleWarnings';

/** Pick the highest severity present in the issue list. */
function worstSeverity(severities: WarningSeverity[]): WarningSeverity | null {
  if (severities.includes('error')) return 'error';
  if (severities.includes('warning')) return 'warning';
  if (severities.includes('info')) return 'info';
  return null;
}

const SiteStateIndicator: React.FC = () => {
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

  const severity = worstSeverity(issues.map(i => i.severity)) ?? 'warning';
  const chipColor: 'error' | 'warning' | 'info' =
    severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'info';

  const tooltip = (
    <Box component="ul" sx={{ pl: 2, m: 0 }}>
      {issues.map(issue => (
        <li key={issue.key}>{issue.message}</li>
      ))}
    </Box>
  );

  return (
    <Tooltip title={tooltip} arrow>
      <Chip
        component={RouterLink}
        to="/sld"
        clickable
        size="small"
        color={chipColor}
        icon={severity === 'error' ? <ErrorIcon /> : <WarningIcon />}
        label={`Site state: ${issues.length} issue${issues.length === 1 ? '' : 's'}`}
        sx={{ ml: 1 }}
      />
    </Tooltip>
  );
};

export default SiteStateIndicator;
