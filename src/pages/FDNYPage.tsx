import React from 'react';
import AlarmHistoryView from '../components/AlarmHistory/AlarmHistoryView';

export const pageConfig = {
  id: 'fdny',
  title: 'FDNY',
  iconPath: '/FDNY.svg',
};

const FDNYPage: React.FC = () => (
  <AlarmHistoryView
    title="FDNY"
    description={
      'Chronological record of alarm state changes. The most recent transition ' +
      'for each alarm is highlighted "CURRENT" when it reflects today\'s ' +
      'active/cleared state.'
    }
    csvFilePrefix="fdny-alarms"
  />
);

export default FDNYPage;
