import React, { useState, useEffect } from 'react';
import { Drawer, List, Typography, Box, Divider, IconButton } from '@mui/material';
import { ChevronLeft, ChevronRight, Logout, ArrowForward } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { SidebarItem } from './SidebarItem';
import { getPageConfig } from '../../config/pageRegistry';

interface SidebarProps {
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = () => { // Removed unused className
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  const getSelectedItem = () => {
    const path = location.pathname;
    if (path === '/' || path === '/overview') return 'overview';
    if (path === '/battery1') return 'battery1';
    if (path === '/battery2') return 'battery2';
    if (path === '/battery3') return 'battery3';
    if (path === '/conedison') return 'conedison';
    if (path === '/fdny') return 'fdny';
    if (path === '/scheduler') return 'scheduler';
    return 'overview';
  };

  // Get navigation items from page configs
  const enabledPageIds = ['overview', 'battery1', 'battery2', 'battery3', 'conedison', 'fdny', 'scheduler'];
  
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
    navigate(`/${id === 'overview' ? '' : id}`);
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/1/logout', {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        window.location.reload();
      } else {
        console.error('Logout failed:', response.statusText);
      }
    } catch (error) {
      console.error('Logout error:', error);
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
