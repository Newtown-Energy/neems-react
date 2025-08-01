import React from 'react';
import { Box, Typography } from '@mui/material';

export const pageConfig = {
  id: 'battery3',
  title: 'Megapack 3',
  iconPath: '/Tesla_Motors.svg'
};

const Battery3Page: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h2" gutterBottom>
        Battery 3
      </Typography>
      <Typography variant="body1">
        Battery 3 monitoring and control interface.
      </Typography>
   </Box>
  );
};

export default Battery3Page;
