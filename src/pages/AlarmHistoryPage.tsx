import React from 'react';
import { History } from '@mui/icons-material';
import AlarmHistoryView from '../components/AlarmHistory/AlarmHistoryView';

export const pageConfig = {
  id: 'alarm-history',
  title: 'Alarm History',
  icon: History,
};

/**
 * Every alarm's state changes over a chosen range. The Alarms page answers
 * "what is wrong now"; this one answers "what has happened", and FDNY is this
 * same view restricted to the fire-related alarms.
 */
const AlarmHistoryPage: React.FC = () => (
  <AlarmHistoryView
    title="Alarm History"
    description={
      'Chronological record of alarm state changes across the site. The most ' +
      'recent transition for each alarm is highlighted "CURRENT" when it ' +
      "reflects today's active/cleared state."
    }
    csvFilePrefix="alarm-history"
  />
);

export default AlarmHistoryPage;
