import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';
import { Schedule } from '@mui/icons-material';

export const pageConfig = {
  id: 'scheduler',
  title: 'Scheduler',
  icon: Schedule
};

const SchedulerPage: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h2" gutterBottom>
        Scheduler
      </Typography>
      
      <Card>
        <CardContent>
          <Typography variant="body1">
            Scheduler functionality will be implemented here.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SchedulerPage;