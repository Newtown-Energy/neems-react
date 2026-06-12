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
 *    Alarms pages.
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

// Match the threshold used by the SLD and Alarms pages.
const STALE_THRESHOLD_SECONDS = 60;

interface BannerAlert {
  key: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

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

  // Live alarm-feed warnings. These mirror the per-page banners on the SLD
  // and Alarms pages but live here so they appear on every view.
  const alarmAlerts = useMemo<BannerAlert[]>(() => {
    const out: BannerAlert[] = [];
    // Can't reach the service at all — supersedes the age-based warning,
    // since the age is unknown / growing while we're offline.
    if (unreachable) {
      out.push({
        key: 'alarm-service-unreachable',
        severity: 'warning',
        title: 'Alarm service unreachable',
        message: 'Unable to reach the alarm service. Displayed alarm state may be outdated.'
      });
    } else if (
      alarmStatus?.data_age_seconds != null &&
      alarmStatus.data_age_seconds > STALE_THRESHOLD_SECONDS
    ) {
      out.push({
        key: 'stale-alarm-data',
        severity: 'warning',
        title: 'Stale alarm data',
        message: `Alarm data is ${alarmStatus.data_age_seconds} seconds old. The RTAC connection may be down.`
      });
    }
    // Surface a known emergency/critical even while unreachable — it was
    // real as of the last successful poll.
    if (alarmStatus?.has_emergency) {
      out.push({
        key: 'emergency-alarms',
        severity: 'error',
        title: 'Emergency alarms active',
        message: 'EMERGENCY alarms are active — immediate action required.'
      });
    } else if (alarmStatus?.has_critical) {
      out.push({
        key: 'critical-alarms',
        severity: 'warning',
        title: 'Critical alarms active',
        message: 'Critical alarms are active — attention required.'
      });
    }
    return out;
  }, [alarmStatus, unreachable]);

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
