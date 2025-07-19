import React from 'react';
import { Box, Typography } from '@mui/material';

const Bay2Page: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h2" gutterBottom>
        Bay 2
      </Typography>
      <Typography variant="body1">
        Bay 2 monitoring and control interface.
      </Typography>
    </Box>
  );
};

export default Bay2Page;