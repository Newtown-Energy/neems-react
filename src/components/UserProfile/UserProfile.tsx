import React from 'react';
import { Box, Typography, Avatar } from '@mui/material';

const UserProfile: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Avatar sx={{ width: 32, height: 32 }}>A</Avatar>
      <Typography variant="body1">Admin</Typography>
    </Box>
  );
};

export default UserProfile;