/**
 * Site State Panel.
 *
 * The app-wide status banner, mounted once above every routed page. It
 * surfaces two kinds of issue as full-width [Alert]s so a problem is
 * obvious at a glance on whichever view the operator is on:
 *  - demo/site-state issues derived from the selected site + demo
 *    overrides (breaker trips, low SoC, curtailment, …), and
 *  - live alarm-feed warnings (stale data, emergency/critical alarms)
 *    polled globally so they show everywhere, not only on the SLD or
 *    Alarms pages. Stale data is raised at the same severity as an
 *    emergency alarm.
 *
 * Renders nothing when the site is healthy, so it adds no visual weight
 * in the common case.
 */

import React, { useMemo } from 'react';
import { Alert, AlertTitle, Stack } from '@mui/material';

import { useSiteContext } from '../../utils/SiteContext';
import { useDemoOverrides } from '../../utils/demoOverrides';
import { evaluateSiteState } from '../../utils/scheduleWarnings';
import { useActiveAlarmStatus } from '../../utils/useActiveAlarmStatus';
import { alarmFeedAlerts } from './alarmFeedAlerts';

const SiteStatePanel: React.FC = () => {
  const { selectedSite } = useSiteContext();
  const { overrides } = useDemoOverrides();
  const { status: alarmStatus, unreachable } = useActiveAlarmStatus(!!selectedSite);

  const issues = useMemo(() => {
    if (!selectedSite) return [];
    return evaluateSiteState(selectedSite, {
      currentSocPercent: overrides.currentSocPercent,
      curtailmentCeilingKw: overrides.curtailmentCeilingKw,
      openBreakers: overrides.openBreakers,
      offlineMegapacks: overrides.offlineMegapacks
    });
  }, [selectedSite, overrides]);

  // Live alarm-feed warnings, polled globally so they show on every page.
  // Stale data is an emergency here, not only on the SLD — see
  // [alarmFeedAlerts].
  const alarmAlerts = useMemo(
    () => alarmFeedAlerts(alarmStatus, unreachable, overrides.ignoreStaleData),
    [alarmStatus, unreachable, overrides.ignoreStaleData]
  );

  if (issues.length === 0 && alarmAlerts.length === 0) return null;

  return (
    <Stack spacing={1} sx={{ mb: 2 }}>
      {alarmAlerts.map(alert => (
        <Alert key={alert.key} severity={alert.severity}>
          <AlertTitle>{alert.title}</AlertTitle>
          {alert.message}
        </Alert>
      ))}
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
