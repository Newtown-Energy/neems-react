import React from 'react';
import { Box, Typography, Avatar } from '@mui/material';

interface UserProfileProps {
  email: string;
}

const UserProfile: React.FC<UserProfileProps> = ({ email }) => {
  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} data-testid="user-profile">
      <Avatar sx={{ width: 32, height: 32 }}>{getInitials(email)}</Avatar>
      <Typography variant="body1">{email}</Typography>
    </Box>
  );
};

export default UserProfile;