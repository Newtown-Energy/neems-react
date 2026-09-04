import React from 'react';
import AlarmHistoryView from '../components/AlarmHistory/AlarmHistoryView';
import { FIRE_ALARM_NUMS } from '../config/fireAlarms';

export const pageConfig = {
  id: 'fdny',
  title: 'FDNY',
  iconPath: '/FDNY.svg',
};

/**
 * The alarm history a fire department is handed: the same view as the Alarm
 * History page, restricted to the alarms the spreadsheet marks as fire-related
 * — the fire panel plus the thermal and sparker alarms on each Megapack.
 *
 * The restriction is the page, not a preset. Everything else on site is noise
 * to a responding crew, and the filter dropdown narrows within the fire set
 * rather than back out of it.
 */
const FDNYPage: React.FC = () => (
  <AlarmHistoryView
    title="FDNY"
    description={
      'Chronological record of fire-related alarm state changes — fire panel, ' +
      'suppression and FLIR zones, and Megapack thermal and sparker alarms. ' +
      'The most recent transition for each alarm is highlighted "CURRENT" when ' +
      "it reflects today's active/cleared state."
    }
    restrictToAlarmNums={FIRE_ALARM_NUMS}
    csvFilePrefix="fdny-fire-alarms"
  />
);

export default FDNYPage;
