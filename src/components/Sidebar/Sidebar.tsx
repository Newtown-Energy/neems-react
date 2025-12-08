import React, { useState, useEffect } from 'react';
import { Drawer, List, Typography, Box, Divider, IconButton } from '@mui/material';
import { ChevronLeft, ChevronRight, Logout, ArrowForward } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { SidebarItem } from './SidebarItem';
import { getPageConfig } from '../../config/pageRegistry';
import { CompanySelector } from '../CompanySelector/CompanySelector';
import { useAuth } from '../../pages/LoginPage/useAuth';
import { debugLog } from '../../utils/debug';

interface SidebarProps {
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = () => { // Removed unused className
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { userInfo } = useAuth();
  
  const getSelectedItem = () => {
    const path = location.pathname;
    if (path === '/' || path === '/overview') return 'overview';
    if (path === '/battery1') return 'battery1';
    if (path === '/conedison') return 'conedison';
    if (path === '/fdny') return 'fdny';
    if (path === '/scheduler' || path === '/library') return 'scheduler';
    if (path === '/admin') return 'admin';
    return 'overview';
  };

  // Get navigation items from page configs
  const enabledPageIds = ['overview', 'battery1', 'conedison', 'fdny', 'scheduler'];
  
  const navItems = enabledPageIds.map(pageId => {
    const config = getPageConfig(pageId);
    if (!config) return null;
    
    return {
      id: config.id,
      icon: config.icon || ArrowForward,
      iconImage: config.iconPath,
      text: config.title
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  const bottomItems = [
    { id: 'logout', icon: Logout, text: 'Logout' }
  ];

  useEffect(() => {
    if (window.innerWidth < 900) setCollapsed(true);
  }, []);

  const handleItemClick = (id: string) => {
    const path = `/${id === 'overview' ? '' : id}`;
    debugLog('Sidebar: Navigation click', { pageId: id, path });
    navigate(path);
  };

  const handleLogout = async () => {
    debugLog('Sidebar: Logout requested');
    try {
      const response = await fetch('/api/1/logout', {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        debugLog('Sidebar: Logout successful, reloading page');
        window.location.reload();
      } else {
        console.error('Logout failed:', response.statusText);
        debugLog('Sidebar: Logout failed', { status: response.status, statusText: response.statusText });
      }
    } catch (error) {
      console.error('Logout error:', error);
      debugLog('Sidebar: Logout error', error);
    }
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: collapsed ? 72 : 240,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: collapsed ? 72 : 240,
          boxSizing: 'border-box',
          transition: 'width 0.3s ease',
          backgroundColor: 'background.paper',
          color: 'text.primary',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
        {!collapsed && (
          <Box
            component="a"
            href="/"
            sx={{
              textDecoration: 'none',
              color: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              '&:hover': {
                opacity: 0.8
              }
            }}
          >
            <Box
              component="img"
              src="/logo.svg"
              alt="NEEMS Logo"
              sx={{
                height: 30,
                width: 30
              }}
            />
            <Typography variant="h6" component="h1" sx={{ fontWeight: 'bold' }}>
              NEEMS
            </Typography>
          </Box>
        )}
        <IconButton onClick={() => setCollapsed(!collapsed)} size="small">
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </IconButton>
      </Box>
      
      <Divider />
      
      <List sx={{ flex: 1 }}>
        {navItems.map((item) => (
          <SidebarItem
            key={item.id}
            icon={item.icon}
            iconImage={item.iconImage}
            text={item.text}
            collapsed={collapsed}
            selected={getSelectedItem() === item.id}
            onClick={() => handleItemClick(item.id)}
          />
        ))}
      </List>
      
      <Divider />
      
      <CompanySelector 
        collapsed={collapsed}
        userRoles={userInfo?.roles || []}
        userCompanyName={userInfo?.company_name}
      />
      
      <Divider />
      
      <List>
        {bottomItems.map((item) => (
          <SidebarItem
            key={item.id}
            icon={item.icon}
            text={item.text}
            collapsed={collapsed}
            selected={getSelectedItem() === item.id}
            onClick={item.id === 'logout' ? handleLogout : () => handleItemClick(item.id)}
          />
        ))}
      </List>
    </Drawer>
  );
};

export default Sidebar;
