// theme.ts
import { createTheme } from '@mui/material/styles';
import type { ThemeOptions } from '@mui/material/styles';
import materialTheme from './material-theme.json';

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

const lightTheme = createTheme({
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
    error: {
      main: materialTheme.schemes.light.error,
      light: materialTheme.palettes.secondary[80], // Using secondary palette for error as per your theme
      dark: materialTheme.palettes.secondary[40],
      contrastText: materialTheme.schemes.light.onError,
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
      active: materialTheme.schemes.light.primary, // or onSurface for general icons
      hover: materialTheme.schemes.light.primaryContainer,
      hoverOpacity: 0.08, // Material 3 recommends 8% opacity for hover
      selected: materialTheme.schemes.light.secondaryContainer,
      selectedOpacity: 0.12, // Material 3 recommends 12% opacity for selected
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
          color: materialTheme.schemes.light.onSurfaceVariant, // Default text color
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
          color: 'inherit', // Inherits from parent ListItemButton
          minWidth: '40px', // Better icon alignment
        },
      },
    },
  },
});

const darkTheme = createTheme({
  ...baseTheme,
  palette: {
    mode: 'dark',
    primary: {
      main: materialTheme.schemes.dark.primary,
      light: materialTheme.palettes.primary[80],
      dark: materialTheme.palettes.primary[40],
      contrastText: materialTheme.schemes.dark.onPrimary,
    },
    secondary: {
      main: materialTheme.schemes.dark.secondary,
      light: materialTheme.palettes.secondary[80],
      dark: materialTheme.palettes.secondary[40],
      contrastText: materialTheme.schemes.dark.onSecondary,
    },
    error: {
      main: materialTheme.schemes.dark.error,
      light: materialTheme.palettes.secondary[80],
      dark: materialTheme.palettes.secondary[40],
      contrastText: materialTheme.schemes.dark.onError,
    },
    background: {
      default: materialTheme.schemes.dark.background,
      paper: materialTheme.schemes.dark.surface,
    },
    text: {
      primary: materialTheme.schemes.dark.onSurface,
      secondary: materialTheme.schemes.dark.onSurfaceVariant,
    },
    divider: materialTheme.schemes.dark.outlineVariant,
    action: {
      active: materialTheme.schemes.dark.primary,
      hover: materialTheme.schemes.dark.primaryContainer,
    },
  },
  components: {
    ...baseTheme.components,
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: materialTheme.schemes.dark.surfaceContainerHigh,
          color: materialTheme.schemes.dark.onSurface,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: materialTheme.schemes.dark.surface,
          color: materialTheme.schemes.dark.onSurface,
        },
      },
    },
  },
});

export const getTheme = (themeMode: 'light' | 'dark') => {
  return themeMode === 'dark' ? darkTheme : lightTheme;
};