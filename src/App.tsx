import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box, AppBar, Toolbar } from '@mui/material';
import Sidebar from './components/Sidebar/Sidebar';
import ThemeSwitcher from "./components/Light-Dark/ThemeSwitcher";
import UserProfile from './components/UserProfile/UserProfile';
import OverviewPage from './pages/OverviewPage';
import Bay1Page from './pages/Bay1Page';
import Bay2Page from './pages/Bay2Page';
import ConEdisonPage from './pages/ConEdisonPage';
import FDNYPage from './pages/FDNYPage';
import AdminPage from './pages/AdminPage';
import SuperAdminPage from './pages/SuperAdminPage';
import './styles/App.scss';
import { useAuth } from './components/LoginPage/useAuth';
import LoginPage from './components/LoginPage/LoginPage';

const AppContent: React.FC = () => {
  const { loading, isAuthenticated, setIsAuthenticated, userEmail, userInfo, saveUserInfo, logout } = useAuth();


  if (loading) return <div>Loading...</div>;

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={(userInfo) => {
      saveUserInfo(userInfo);
      setIsAuthenticated(true);
    }} />;
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
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
            <Route path="/bay1" element={<Bay1Page />} />
            <Route path="/bay2" element={<Bay2Page />} />
            <Route path="/conedison" element={<ConEdisonPage />} />
            <Route path="/fdny" element={<FDNYPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/super-admin" element={<SuperAdminPage />} />
          </Routes>
        </Box>
      </Box>
  );
};

const App: React.FC = () => {
  console.log(`React app running on ${window.location.protocol}//${window.location.host}`);

  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;



