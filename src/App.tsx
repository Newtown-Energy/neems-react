import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import Sidebar from './components/Sidebar/Sidebar';
import OverviewPage from './pages/OverviewPage';
import FDNYPage from './pages/FDNYPage';
import AdminPage from './pages/AdminPage';
import AlarmsPage from './pages/AlarmsPage';
import ReportsPage from './pages/ReportsPage';
import SchedulerPage from './pages/SchedulerPage';
import LibraryPage from './pages/LibraryPage';
import ScheduleAuditPage from './pages/ScheduleAuditPage';
import SldPage from './pages/SldPage';
import SiteStatePanel from './components/SiteStatePanel/SiteStatePanel';
import DemoControlsDrawer from './components/DemoControlsDrawer/DemoControlsDrawer';
import './styles/App.scss';
import { useAuth } from './pages/LoginPage/useAuth';
import LoginPage from './pages/LoginPage/LoginPage';
import { debugLog } from './utils/debug';
import { SiteProvider } from './utils/SiteContext';
import { DemoOverridesProvider } from './utils/demoOverrides';

/** App-wide banner host. Mounted once at the top of every page so the
 *  same content appears in the same spot regardless of route. Lives
 *  inside the Router/providers so SiteStatePanel can read the site +
 *  overrides. */
const SiteStateBannerSlot: React.FC = () => (
  <Box sx={{ px: 2, pt: 1 }}>
    <SiteStatePanel />
  </Box>
);

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
          {/* App-wide site-state banner. Renders nothing for a healthy
              site; otherwise the same content appears at the top of
              every page including /sld. */}
          <SiteStateBannerSlot />
          <Routes>
            <Route path="/" element={<Navigate to="/sld" replace />} />
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/alarms" element={<AlarmsPage />} />
            <Route path="/fdny" element={<FDNYPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/scheduler" element={<SchedulerPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/library/:itemId/audit" element={<ScheduleAuditPage />} />
            <Route path="/sld" element={<SldPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </Box>
      </Box>
      {/* Floating launcher; self-gates to admin and self-positions
          fixed bottom-right of the viewport. */}
      <DemoControlsDrawer />
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
