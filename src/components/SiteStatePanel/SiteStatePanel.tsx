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
 *
 * One alert is route-dependent: `hideAlarmSeverityAlert` drops the
 * emergency/critical bar, which the SLD asks for because the diagram
 * says it already. The caller decides that — see [SiteStateBannerSlot].
 */

import React, { useMemo } from 'react';
import { Alert, AlertTitle, Stack } from '@mui/material';

import { useSiteContext } from '../../utils/SiteContext';
import { useDemoOverrides } from '../../utils/demoOverrides';
import { evaluateSiteState } from '../../utils/scheduleWarnings';
import { useActiveAlarmStatus } from '../../utils/useActiveAlarmStatus';
import { alarmFeedAlerts, isAlarmSeverityAlert } from './alarmFeedAlerts';

interface SiteStatePanelProps {
  /** Drop the emergency/critical alarm alert, keeping every other banner.
   *  For the SLD, where the diagram announces an emergency on its own —
   *  see [isAlarmSeverityAlert]. */
  hideAlarmSeverityAlert?: boolean;
}

const SiteStatePanel: React.FC<SiteStatePanelProps> = ({ hideAlarmSeverityAlert = false }) => {
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
  const alarmAlerts = useMemo(() => {
    const alerts = alarmFeedAlerts(alarmStatus, unreachable, overrides.ignoreStaleData);
    return hideAlarmSeverityAlert ? alerts.filter(a => !isAlarmSeverityAlert(a)) : alerts;
  }, [alarmStatus, unreachable, overrides.ignoreStaleData, hideAlarmSeverityAlert]);

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
