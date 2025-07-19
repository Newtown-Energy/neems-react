import React from 'react';
import { Box, Typography, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, List, ListItem, ListItemText, ListItemIcon, AppBar, Toolbar } from '@mui/material';
import { TrendingDown, CheckCircle } from '@mui/icons-material';
import Sidebar from './components/Sidebar/Sidebar';
import ThemeSwitcher from "./components/Light-Dark/ThemeSwitcher";
import UserProfile from './components/UserProfile/UserProfile';
import './styles/App.scss';
import { useAuth } from './components/LoginPage/useAuth';
import LoginPage from './components/LoginPage/LoginPage';

const App: React.FC = () => {
  console.log(`React app running on ${window.location.protocol}//${window.location.host}`);

  const { loading, isAuthenticated, setIsAuthenticated, userEmail } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <Sidebar />
      <Box component="main" sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Box></Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ThemeSwitcher />
              <UserProfile email={userEmail || 'Unknown User'} />
            </Box>
          </Toolbar>
        </AppBar>
        
        <Box sx={{ flex: 1, p: 3 }}>
          <Typography variant="h2" gutterBottom>
            Overview
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3, mb: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Monthly flibbers
                </Typography>
                <Typography variant="h4" component="div">
                  1,018
                </Typography>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Total Whatchamacallits
                </Typography>
                <Typography variant="h4" component="div">
                  5,133
                </Typography>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  TSLA share price
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingDown color="error" />
                  <Typography variant="h4" component="div" color="error">
                    22.8%
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Latest Alarms
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Issue</TableCell>
                        <TableCell>Magnitude</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Timestamp</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>Sensor 1 over temp</TableCell>
                        <TableCell>165°F</TableCell>
                        <TableCell>Alerted via email</TableCell>
                        <TableCell>2025-04-08 12:04:00 UTC-4</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Sensor 1 over temp</TableCell>
                        <TableCell>158°F</TableCell>
                        <TableCell>Alerted via email</TableCell>
                        <TableCell>2025-04-08 12:03:00 UTC-4</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Sensor 1 over temp</TableCell>
                        <TableCell>153°F</TableCell>
                        <TableCell>Alerted via email</TableCell>
                        <TableCell>2025-04-08 12:02:00 UTC-4</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Sensor 1 over temp</TableCell>
                        <TableCell>151°F</TableCell>
                        <TableCell>Alerted via email</TableCell>
                        <TableCell>2025-04-08 12:01:00 UTC-4</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Sensor 1 over temp</TableCell>
                        <TableCell>150°F</TableCell>
                        <TableCell>Alerted via email</TableCell>
                        <TableCell>2025-04-08 12:00:00 UTC-4</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  System Maintenance Checklist
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText primary="Upgrades" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText primary="Patches" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText primary="Backup" />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default App;



