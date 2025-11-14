import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box, AppBar, Toolbar } from '@mui/material';
import Sidebar from './components/Sidebar/Sidebar';
import ThemeSwitcher from "./components/Light-Dark/ThemeSwitcher";
import UserProfile from './components/UserProfile/UserProfile';
import OverviewPage from './pages/OverviewPage';
import Battery1Page from './pages/Battery1Page';
import Battery2Page from './pages/Battery2Page';
import Battery3Page from './pages/Battery3Page';
import ConEdisonPage from './pages/ConEdisonPage';
import FDNYPage from './pages/FDNYPage';
import AdminPage from './pages/AdminPage';
import SchedulerPage from './pages/SchedulerPage';
import LibraryPage from './pages/LibraryPage';
import './styles/App.scss';
import { useAuth } from './pages/LoginPage/useAuth';
import LoginPage from './pages/LoginPage/LoginPage';
import { debugLog } from './utils/debug';

const AppContent: React.FC = () => {
  const { loading, isAuthenticated, setIsAuthenticated, userEmail, userInfo, saveUserInfo, logout } = useAuth();

  debugLog('Router: AppContent render', {
    loading,
    isAuthenticated,
    userEmail,
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
    <Box id="authed-ui-box" sx={{ display: 'flex', height: '100vh' }}>
      <Sidebar />
      <Box component="main" sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar sx={{ justifyContent: 'space-between' }}>
              <Box></Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ThemeSwitcher />
              <UserProfile
                email={userEmail || 'Unknown User'}
                userInfo={userInfo}
                onLogout={logout}
              />
            </Box>
          </Toolbar>
        </AppBar>

          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/overview" element={<Navigate to="/" replace />} />
            <Route path="/battery1" element={<Battery1Page />} />
            <Route path="/battery2" element={<Battery2Page />} />
            <Route path="/battery3" element={<Battery3Page />} />
            <Route path="/conedison" element={<ConEdisonPage />} />
            <Route path="/fdny" element={<FDNYPage />} />
            <Route path="/scheduler" element={<SchedulerPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </Box>
      </Box>
  );
};

const App: React.FC = () => {
  console.log(`React app running on ${window.location.protocol}//${window.location.host}`);
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
