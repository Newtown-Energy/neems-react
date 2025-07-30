import React from 'react';
import { Box, Typography } from '@mui/material';

const Battery1Page: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h2" gutterBottom>
        Battery 1
      </Typography>
      <Typography variant="body1">
        Battery 1 monitoring and control interface.
      </Typography>
    </Box>
  );
};

export default Battery1Page;
