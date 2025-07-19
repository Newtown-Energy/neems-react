import React, { useState } from 'react';
import { Box, Typography, Avatar, Menu, MenuItem, Divider, ListItemIcon } from '@mui/material';
import { AdminPanelSettings, SupervisorAccount, Logout } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import type { UserInfo } from '../../types/auth';

interface UserProfileProps {
  email: string;
  userInfo?: UserInfo | null;
  onLogout?: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ 
  email, 
  userInfo,
  onLogout
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const navigate = useNavigate();

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    onLogout?.();
  };

  const handleAdminPanel = () => {
    handleClose();
    navigate('/admin');
  };

  const handleNewtownAdmin = () => {
    handleClose();
    navigate('/newtown-admin');
  };
  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  // Extract roles from userInfo, with fallback to empty array
  const userRoles = userInfo?.roles || [];
  const isAdmin = userRoles.includes('admin') || userRoles.includes('newtown-admin');
  const isNewtownAdmin = userRoles.includes('newtown-admin');

  return (
    <>
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1, 
          cursor: 'pointer',
          '&:hover': {
            opacity: 0.8
          }
        }} 
        data-testid="user-profile"
        onClick={handleClick}
      >
        <Avatar sx={{ width: 32, height: 32 }}>{getInitials(email)}</Avatar>
        <Typography variant="body1">{email}</Typography>
      </Box>
      
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {userInfo && (
          <>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {userInfo.institution_name}
              </Typography>
            </Box>
            <Divider />
          </>
        )}
        
        {isNewtownAdmin && (
          <MenuItem onClick={handleNewtownAdmin}>
            <ListItemIcon>
              <SupervisorAccount fontSize="small" />
            </ListItemIcon>
            Newtown Admin
          </MenuItem>
        )}
        
        {isAdmin && (
          <MenuItem onClick={handleAdminPanel}>
            <ListItemIcon>
              <AdminPanelSettings fontSize="small" />
            </ListItemIcon>
            Admin Panel
          </MenuItem>
        )}
        
        {(isNewtownAdmin || isAdmin) && <Divider />}
        
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>
    </>
  );
};

export default UserProfile;