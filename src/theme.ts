import { createTheme } from '@mui/material/styles';
import type { ThemeOptions } from '@mui/material/styles';
import materialTheme from './material-theme.json';

// Canonical alarm-severity palette — the single source of truth for severity
// colors across the app (SLD component highlights, the main-pane border, alarm
// badges, and every MUI severity Chip). Each severity reads distinctly at a
// glance: Emergency → red, Critical → orange, Warning → yellow, Info → blue.
// `severityColor()` (SLD SVG visuals) and `getSeverityColor()` (Chip color
// prop) both resolve to these entries so the two never drift apart.
declare module '@mui/material/styles' {
  interface Palette {
    severityEmergency: Palette['error'];
    severityCritical: Palette['error'];
    severityWarning: Palette['error'];
    severityInfo: Palette['error'];
  }
  interface PaletteOptions {
    severityEmergency?: PaletteOptions['error'];
    severityCritical?: PaletteOptions['error'];
    severityWarning?: PaletteOptions['error'];
    severityInfo?: PaletteOptions['error'];
  }
}

declare module '@mui/material/Chip' {
  interface ChipPropsColorOverrides {
    severityEmergency: true;
    severityCritical: true;
    severityWarning: true;
    severityInfo: true;
  }
}

const baseTheme: ThemeOptions = {
  typography: {
    fontFamily: '"Inter", "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        },
      },
    },
  },
};

export const theme = createTheme({
  ...baseTheme,
  palette: {
    mode: 'light',
    primary: {
      main: materialTheme.schemes.light.primary,
      light: materialTheme.palettes.primary[80],
      dark: materialTheme.palettes.primary[40],
      contrastText: materialTheme.schemes.light.onPrimary,
    },
    secondary: {
      main: materialTheme.schemes.light.secondary,
      light: materialTheme.palettes.secondary[80],
      dark: materialTheme.palettes.secondary[40],
      contrastText: materialTheme.schemes.light.onSecondary,
    },
    // Alarms/emergencies use a vivid safety red (think real-world e-stop
    // button) rather than the muted Material-3 generated error tone, so the
    // Emergency severity reads as urgent everywhere it surfaces: alarm pills,
    // FDNY severity chips, SLD component highlights, and active-transition text
    // all derive from error.main.
    error: {
      main: '#D50000',
      light: '#FF5131',
      dark: '#9B0000',
      contrastText: '#FFFFFF',
    },
    // Severity palette — see the module augmentation above. Emergency reuses the
    // safety red from `error.main`; Critical/Warning use deliberate orange/yellow
    // hexes (MUI has no yellow named color) so Warning and Critical stay distinct;
    // Info is the standard MUI blue. Warning's yellow needs dark text for contrast.
    severityEmergency: {
      main: '#D50000',
      contrastText: '#FFFFFF',
    },
    severityCritical: {
      main: '#F57C00',
      contrastText: '#FFFFFF',
    },
    severityWarning: {
      main: '#FFC107',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    severityInfo: {
      main: '#0288D1',
      contrastText: '#FFFFFF',
    },
    background: {
      default: materialTheme.schemes.light.background,
      paper: materialTheme.schemes.light.surface,
    },
    text: {
      primary: materialTheme.schemes.light.onSurface,
      secondary: materialTheme.schemes.light.onSurfaceVariant,
    },
    divider: materialTheme.schemes.light.outlineVariant,
    action: {
      active: materialTheme.schemes.light.primary,
      hover: materialTheme.schemes.light.primaryContainer,
      hoverOpacity: 0.08,
      selected: materialTheme.schemes.light.secondaryContainer,
      selectedOpacity: 0.12,
      disabled: materialTheme.schemes.light.onSurface,
      disabledOpacity: 0.38,
      focus: materialTheme.schemes.light.primary,
      focusOpacity: 0.12,
      activatedOpacity: 0.12,
    },
  },
  components: {
    ...baseTheme.components,
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: materialTheme.schemes.light.surfaceContainerHigh,
          color: materialTheme.schemes.light.onSurface,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: materialTheme.schemes.light.surface,
          color: materialTheme.schemes.light.onSurface,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          color: materialTheme.schemes.light.onSurfaceVariant,
          '&:hover': {
            backgroundColor: materialTheme.schemes.light.primaryContainer,
            color: materialTheme.schemes.light.onPrimaryContainer,
          },
          '&.Mui-selected': {
            backgroundColor: materialTheme.schemes.light.secondaryContainer,
            color: materialTheme.schemes.light.onSecondaryContainer,
            '&:hover': {
              backgroundColor: materialTheme.schemes.light.secondaryContainer,
              opacity: 0.9,
            },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          color: 'inherit',
          minWidth: '40px',
        },
      },
    },
  },
});
