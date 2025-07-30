import React from 'react';
import { Box, Typography } from '@mui/material';

const Battery2Page: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h2" gutterBottom>
        Battery 2
      </Typography>
      <Typography variant="body1">
        Battery 2 monitoring and control interface.
      </Typography>
    </Box>
  );
};

export default Battery2Page;
