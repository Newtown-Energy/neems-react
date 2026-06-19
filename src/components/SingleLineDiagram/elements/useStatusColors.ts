import { useTheme, type Theme } from '@mui/material';
import type { AlarmSeverityDto } from '@newtown-energy/types';
import type { SldComponentState } from '../types';

interface StatusColors {
  stroke: string;
  fill: string;
  strokeWidth: number;
  /** True for Emergency/Critical — callers may use this to toggle pulse animations. */
  shouldPulse: boolean;
}

/**
 * Severity-specific palette for SLD visuals. Resolves to the canonical severity
 * colors defined on the theme palette (see `theme.ts`), so SLD highlights,
 * borders, and badges stay in lockstep with the severity Chips rendered via
 * `getSeverityColor()`. Each severity reads distinctly at a glance:
 *   Emergency → red, Critical → orange, Warning → yellow, Info → blue.
 */
export function severityColor(
  severity: AlarmSeverityDto,
  theme: Theme,
): string {
  switch (severity) {
    case 'Emergency':
      return theme.palette.severityEmergency.main;
    case 'Critical':
      return theme.palette.severityCritical.main;
    case 'Warning':
      return theme.palette.severityWarning.main;
    case 'Info':
      return theme.palette.severityInfo.main;
  }
}

/**
 * Maps a component's status (and highest active severity) to SVG
 * stroke/fill colors from the MUI theme. Normal state uses the theme's text
 * color with no fill. Alarm/warning states use severity-specific tints so
 * Emergency vs Critical vs Warning are each visually distinct.
 */
export function useStatusColors(state: SldComponentState): StatusColors {
  const theme = useTheme();

  switch (state.status) {
    case 'alarm': {
      const color = state.highestSeverity
        ? severityColor(state.highestSeverity, theme)
        : theme.palette.error.main;
      return {
        stroke: color,
        fill: `${color}25`,
        strokeWidth: 3,
        shouldPulse:
          state.highestSeverity === 'Emergency' ||
          state.highestSeverity === 'Critical',
      };
    }
    case 'warning': {
      const color = state.highestSeverity
        ? severityColor(state.highestSeverity, theme)
        : theme.palette.warning.main;
      return {
        stroke: color,
        fill: `${color}20`,
        strokeWidth: 2.5,
        shouldPulse: false,
      };
    }
    case 'offline':
      return {
        stroke: theme.palette.action.disabled,
        fill: 'none',
        strokeWidth: 1.5,
        shouldPulse: false,
      };
    case 'normal':
      return {
        stroke: theme.palette.text.primary,
        fill: 'none',
        strokeWidth: 2,
        shouldPulse: false,
      };
  }
}
