import React, { useState, useEffect } from 'react';
import { Drawer, List, ListItem, ListItemIcon, ListItemText, IconButton, Typography, Box, Divider } from '@mui/material';
import { Dashboard, BatteryFull, ChevronLeft, ChevronRight, Logout } from '@mui/icons-material';

interface SidebarProps {
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Collapse sidebar by default on mobile
    if (window.innerWidth < 900) {
      setCollapsed(true);
    }
  }, []);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
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
        },
      }}
      className={className}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
        {!collapsed && (
          <Typography variant="h6" component="h1" sx={{ fontWeight: 'bold' }}>
            NEEMS
          </Typography>
        )}
        <IconButton onClick={toggleSidebar} size="small">
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </IconButton>
      </Box>
      
      <Divider />
      
      <List sx={{ flex: 1 }}>
        <ListItem
          component="button"
          sx={{
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': { backgroundColor: 'primary.dark' },
          }}
        >
          <ListItemIcon sx={{ color: 'inherit' }}>
            <Dashboard />
          </ListItemIcon>
          {!collapsed && <ListItemText primary="Overview" />}
        </ListItem>
        
        <ListItem component="button">
          <ListItemIcon>
            <BatteryFull />
          </ListItemIcon>
          {!collapsed && <ListItemText primary="Bay 1" />}
        </ListItem>
        
        <ListItem component="button">
          <ListItemIcon>
            <BatteryFull />
          </ListItemIcon>
          {!collapsed && <ListItemText primary="Bay 2" />}
        </ListItem>
        
        <ListItem component="button">
          <ListItemIcon>
            <Box component="img" src="/con-edison.svg" alt="Con Edison" sx={{ width: 24, height: 24 }} />
          </ListItemIcon>
          {!collapsed && <ListItemText primary="Con Edison" />}
        </ListItem>
        
        <ListItem component="button">
          <ListItemIcon>
            <Box component="img" src="/FDNY.svg" alt="FDNY" sx={{ width: 24, height: 24 }} />
          </ListItemIcon>
          {!collapsed && <ListItemText primary="FDNY" />}
        </ListItem>
      </List>
      
      <Divider />
      
      <List>
        <ListItem component="button">
          <ListItemIcon>
            <Logout />
          </ListItemIcon>
          {!collapsed && <ListItemText primary="Logout" />}
        </ListItem>
      </List>
    </Drawer>
  );
};

export default Sidebar;