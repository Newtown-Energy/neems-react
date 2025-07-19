import React from 'react';
import { Box, Typography } from '@mui/material';

const Bay1Page: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h2" gutterBottom>
        Bay 1
      </Typography>
      <Typography variant="body1">
        Bay 1 monitoring and control interface.
      </Typography>
    </Box>
  );
};

export default Bay1Page;