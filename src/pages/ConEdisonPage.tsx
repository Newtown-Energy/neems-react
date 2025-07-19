import React from 'react';
import { Box, Typography } from '@mui/material';

const ConEdisonPage: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h2" gutterBottom>
        Con Edison
      </Typography>
      <Typography variant="body1">
        Con Edison integration and monitoring interface.
      </Typography>
    </Box>
  );
};

export default ConEdisonPage;