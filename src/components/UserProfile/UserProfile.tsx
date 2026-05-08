import React, { useState } from 'react';
import { Box, Typography, Avatar, Menu, MenuItem, Divider, ListItemIcon } from '@mui/material';
import { AdminPanelSettings, Logout } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import type { UserInfo } from '../../types/auth';
import { isAdmin } from '../../utils/auth';

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
  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  const showAdminPanel = isAdmin(userInfo?.roles);

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
                {userInfo.company_name}
              </Typography>
            </Box>
            <Divider />
          </>
        )}
        
        {showAdminPanel && (
          <MenuItem onClick={handleAdminPanel}>
            <ListItemIcon>
              <AdminPanelSettings fontSize="small" />
            </ListItemIcon>
            Admin Panel
          </MenuItem>
        )}

        {showAdminPanel && <Divider />}
        
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