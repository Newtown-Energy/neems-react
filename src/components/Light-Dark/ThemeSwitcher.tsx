import React from "react";
import { Switch, Box } from '@mui/material';
import { LightMode, DarkMode } from '@mui/icons-material';
import { useTheme } from '../ThemeProvider';
import "./ThemeSwitcher.scss";

const ThemeSwitcher: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <LightMode sx={{
      		 color: theme === 'light' ? 'primary.main' : 'text.secondary',
		 margin: '-8px',
      		 fontSize: '20px'
      }} />
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
	  padding: '8px',
	  margin: '0px',
        }}
      />
      <DarkMode sx={{
      		color: theme === 'dark' ? 'primary.main' : 'text.secondary',
		margin: '-8px',
		marginRight: '10px',
      		fontSize: '20px'
      }} />
    </Box>
  );
};

export default ThemeSwitcher;