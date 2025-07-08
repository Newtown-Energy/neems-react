import React from "react";
import { Switch, Box } from '@mui/material';
import { LightMode, DarkMode } from '@mui/icons-material';
import { useTheme } from '../ThemeProvider';
import "./ThemeSwitcher.scss";

const ThemeSwitcher: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <LightMode sx={{ color: theme === 'light' ? 'primary.main' : 'text.secondary' }} />
      <Switch
        checked={theme === 'dark'}
        onChange={toggleTheme}
        inputProps={{ 'aria-label': `Switch to ${theme === "light" ? "dark" : "light"} mode` }}
        sx={{
          '& .MuiSwitch-switchBase.Mui-checked': {
            color: 'primary.main',
          },
          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
            backgroundColor: 'primary.main',
          },
        }}
      />
      <DarkMode sx={{ color: theme === 'dark' ? 'primary.main' : 'text.secondary' }} />
    </Box>
  );
};

export default ThemeSwitcher;