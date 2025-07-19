import React from 'react';
import { Box, Typography } from '@mui/material';

const AdminPage: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h2" gutterBottom>
        Admin Panel
      </Typography>
      <Typography variant="body1">
        Administrative interface and system management.
      </Typography>
    </Box>
  );
};

export default AdminPage;