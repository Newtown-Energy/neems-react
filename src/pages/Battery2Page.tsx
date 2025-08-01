import React from 'react';
import { Box, Typography } from '@mui/material';

export const pageConfig = {
  id: 'battery2',
  title: 'Megapack 2',
  iconPath: '/Tesla_Motors.svg'
};

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
