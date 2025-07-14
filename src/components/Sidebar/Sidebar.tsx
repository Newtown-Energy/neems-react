import React, { useState, useEffect } from 'react';
import { Drawer, List, Typography, Box, Divider, IconButton } from '@mui/material';
import { Dashboard, BatteryFull, ChevronLeft, ChevronRight, Logout } from '@mui/icons-material';
import { SidebarItem } from './SidebarItem';

interface SidebarProps {
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = () => { // Removed unused className
  const [collapsed, setCollapsed] = useState(false);
  const [selectedItem, setSelectedItem] = useState('overview');

  // Navigation items with required icons
  const navItems = [
    { id: 'overview', icon: Dashboard, text: 'Overview' },
    { id: 'bay1', icon: BatteryFull, text: 'Bay 1' },
    { id: 'bay2', icon: BatteryFull, text: 'Bay 2' },
    { id: 'conedison', icon: BatteryFull, iconImage: '/con-edison.svg', text: 'Con Edison' },
    { id: 'fdny', icon: BatteryFull, iconImage: '/FDNY.svg', text: 'FDNY' }
  ];

  const bottomItems = [
    { id: 'logout', icon: Logout, text: 'Logout' }
  ];

  useEffect(() => {
    if (window.innerWidth < 900) setCollapsed(true);
  }, []);

  const handleItemClick = (id: string) => {
    setSelectedItem(id);
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
          <Typography variant="h6" component="h1" sx={{ fontWeight: 'bold' }}>
            NEEMS
          </Typography>
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
            selected={selectedItem === item.id}
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
            selected={selectedItem === item.id}
            onClick={item.id === 'logout' ? handleLogout : () => handleItemClick(item.id)}
          />
        ))}
      </List>
    </Drawer>
  );
};

export default Sidebar;
