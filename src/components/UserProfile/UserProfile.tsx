import React from 'react';
import { Box, Typography, Avatar, Tooltip } from '@mui/material';
import { UserInfo } from '../../types/auth';

interface UserProfileProps {
  email: string;
  userInfo?: UserInfo | null;
}

const UserProfile: React.FC<UserProfileProps> = ({ email, userInfo }) => {
  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  const tooltipContent = userInfo ? (
    <Box>
      <Typography variant="body2">ID: {userInfo.user_id}</Typography>
      <Typography variant="body2">Institution: {userInfo.institution_name}</Typography>
      <Typography variant="body2">Roles: {userInfo.roles.join(', ')}</Typography>
    </Box>
  ) : null;

  return (
    <Tooltip title={tooltipContent} arrow placement="bottom-end">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }} data-testid="user-profile">
        <Avatar sx={{ width: 32, height: 32 }}>{getInitials(email)}</Avatar>
        <Typography variant="body1">{email}</Typography>
      </Box>
    </Tooltip>
  );
};

export default UserProfile;