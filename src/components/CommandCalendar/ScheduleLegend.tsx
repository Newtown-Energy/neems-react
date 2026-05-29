/**
 * Color key for the charge/discharge/trickle bars drawn in each calendar
 * day cell (see DayBarChart). Rendered directly beneath the schedule
 * calendar so the legend sits next to the thing it explains.
 */

import React from 'react';
import { Box, Typography } from '@mui/material';

import { COMMAND_BAR_COLORS } from '../../utils/scheduleHelpers';

const LEGEND_ENTRIES = [
  { color: COMMAND_BAR_COLORS.charge, label: 'Charge' },
  { color: COMMAND_BAR_COLORS.discharge, label: 'Discharge' },
  { color: COMMAND_BAR_COLORS.trickle_charge, label: 'Trickle' },
] as const;

const ScheduleLegend: React.FC = () => (
  <Box
    sx={{
      display: 'flex',
      gap: 2,
      justifyContent: 'center',
      flexWrap: 'wrap',
      py: 1,
    }}
  >
    {LEGEND_ENTRIES.map(({ color, label }) => (
      <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
        <Typography variant="caption" color="text.secondary" noWrap>
          {label}
        </Typography>
      </Box>
    ))}
  </Box>
);

export default ScheduleLegend;
