import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import Sidebar from './components/Sidebar/Sidebar';
import OverviewPage from './pages/OverviewPage';
import FDNYPage from './pages/FDNYPage';
import AdminPage from './pages/AdminPage';
import AlarmsPage from './pages/AlarmsPage';
import SchedulerPage from './pages/SchedulerPage';
import LibraryPage from './pages/LibraryPage';
import ScheduleAuditPage from './pages/ScheduleAuditPage';
import SldPage from './pages/SldPage';
import './styles/App.scss';
import { useAuth } from './pages/LoginPage/useAuth';
import LoginPage from './pages/LoginPage/LoginPage';
import { debugLog } from './utils/debug';
import { SiteProvider } from './utils/SiteContext';
import { DemoOverridesProvider } from './utils/demoOverrides';

const AppContent: React.FC = () => {
  const { loading, isAuthenticated, setIsAuthenticated, saveUserInfo } = useAuth();

  debugLog('Router: AppContent render', {
    loading,
    isAuthenticated,
    currentPath: window.location.pathname
  });

  if (loading) {
    debugLog('Router: Showing loading state');
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    debugLog('Router: User not authenticated, showing login page');
    return <LoginPage onLoginSuccess={(userInfo) => {
      debugLog('Router: Login successful', { email: userInfo.email });
      saveUserInfo(userInfo);
      setIsAuthenticated(true);
    }} />;
  }

  debugLog('Router: User authenticated, showing main app');

  return (
    <SiteProvider>
      <DemoOverridesProvider>
      <Box id="authed-ui-box" sx={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <Sidebar />
        <Box component="main" sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/sld" replace />} />
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/alarms" element={<AlarmsPage />} />
            <Route path="/fdny" element={<FDNYPage />} />
            <Route path="/scheduler" element={<SchedulerPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/library/:itemId/audit" element={<ScheduleAuditPage />} />
            <Route path="/sld" element={<SldPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </Box>
      </Box>
      </DemoOverridesProvider>
    </SiteProvider>
  );
};

const App: React.FC = () => {
  debugLog('Router: App initializing', {
    host: window.location.host,
    protocol: window.location.protocol,
    pathname: window.location.pathname,
    search: window.location.search
  });

  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;
