import React from 'react';
import { Box, Typography } from '@mui/material';

export const pageConfig = {
  id: 'battery1',
  title: 'Tesla Site Controller',
  iconPath: '/Tesla_Motors.svg'
};

const Battery1Page: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h2" gutterBottom>
        Tesla Site Controller
      </Typography>
      <Typography variant="body1">
        Tesla Site Controller monitoring and control interface.
      </Typography>
    </Box>
  );
};

export default Battery1Page;
