import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import SiteStatePanel from './components/SiteStatePanel/SiteStatePanel';
import './styles/App.scss';
import { useAuth } from './pages/LoginPage/useAuth';
import LoginPage from './pages/LoginPage/LoginPage';
import { debugLog } from './utils/debug';
import { SiteProvider } from './utils/SiteContext';
import { DemoOverridesProvider } from './utils/demoOverrides';

/** App-wide banner host that suppresses the panel on /sld. Lives
 *  inside the Router so it can read the current location, and inside
 *  the providers so SiteStatePanel can read the site + overrides. */
const SiteStateBannerSlot: React.FC = () => {
  const location = useLocation();
  if (location.pathname.startsWith('/sld')) return null;
  return (
    <Box sx={{ px: 2, pt: 1 }}>
      <SiteStatePanel />
    </Box>
  );
};

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
              site, and is suppressed on /sld where the page already
              mounts its own SiteStatePanel — having it twice on the
              same screen is noise. */}
          <SiteStateBannerSlot />
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
