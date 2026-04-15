import { useTheme } from '@mui/material';
import type { SldComponentState } from '../types';

interface StatusColors {
  stroke: string;
  fill: string;
  strokeWidth: number;
}

/**
 * Maps a component's status to SVG stroke/fill colors from the MUI theme.
 * Normal state uses the theme's text color with no fill.
 * Alarm/warning states use semantic colors.
 */
export function useStatusColors(state: SldComponentState): StatusColors {
  const theme = useTheme();

  switch (state.status) {
    case 'alarm':
      return {
        stroke: theme.palette.error.main,
        fill: `${theme.palette.error.main}20`,
        strokeWidth: 2.5,
      };
    case 'warning':
      return {
        stroke: theme.palette.warning.main,
        fill: `${theme.palette.warning.main}15`,
        strokeWidth: 2,
      };
    case 'offline':
      return {
        stroke: theme.palette.action.disabled,
        fill: 'none',
        strokeWidth: 1.5,
      };
    case 'normal':
      return {
        stroke: theme.palette.text.primary,
        fill: 'none',
        strokeWidth: 2,
      };
  }
}
