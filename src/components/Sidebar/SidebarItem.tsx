import React from 'react';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

interface SidebarItemProps {
  icon: React.ComponentType;
  iconImage?: string;
  iconAlt?: string;
  text: string;
  collapsed: boolean;
  selected?: boolean;
  onClick?: () => void;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  icon: Icon,
  iconImage,
  iconAlt,
  text,
  collapsed,
  selected = false,
  onClick
}) => {
  return (
    <ListItem disablePadding>
      <ListItemButton
        selected={selected}
        onClick={onClick}
        sx={{
          px: collapsed ? 2 : 2.5,
          py: 1,
          borderRadius: 2,
          justifyContent: collapsed ? 'center' : 'flex-start',
          minHeight: 48,
        }}
      >
        <ListItemIcon sx={{ 
          color: 'inherit',
          minWidth: 'auto',
          mr: collapsed ? 0 : 2,
          justifyContent: 'center'
        }}>
          {iconImage ? (
            <img 
              src={iconImage} 
              alt={iconAlt || text} 
              style={{ width: 30, height: 30, objectFit: 'contain' }}
            />
          ) : (
            <Icon />
          )}
        </ListItemIcon>
        {!collapsed && (
          <ListItemText 
            primary={text} 
            primaryTypographyProps={{ 
              fontWeight: selected ? 600 : 500,
              noWrap: true
            }}
          />
        )}
      </ListItemButton>
    </ListItem>
  );
};