import React from 'react';
import { Box, Typography } from '@mui/material';

const FDNYPage: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h2" gutterBottom>
        FDNY
      </Typography>
      <Typography variant="body1">
        FDNY integration and monitoring interface.
      </Typography>
    </Box>
  );
};

export default FDNYPage;