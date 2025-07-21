import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab
} from '@mui/material';
import { Add, Edit, Delete, Refresh, Person, LocationOn } from '@mui/icons-material';
import { useAuth } from '../components/LoginPage/useAuth';
import { useSearchParams } from 'react-router-dom';
import type { SelectChangeEvent } from '@mui/material';

interface User {
  id: number;
  email: string;
  company_name: string;
  company_id: number;
  roles: string[];
  created_at: string;
}

interface Site {
  id: number;
  name: string;
  location: string;
  company_id: number;
  company_name: string;
  status: string;
}

interface Company {
  id: number;
  name: string;
}

const AdminPage: React.FC = () => {
  const { userInfo } = useAuth();
  const [searchParams] = useSearchParams();
  const [tabValue, setTabValue] = useState(0);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(0);
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User management state
  const [userDialog, setUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userCompany, setUserCompany] = useState<number>(0);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [deleteUserDialog, setDeleteUserDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Site management state
  const [siteDialog, setSiteDialog] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [siteName, setSiteName] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [siteCompany, setSiteCompany] = useState<number>(0);
  const [deleteSiteDialog, setDeleteSiteDialog] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<Site | null>(null);

  // Role checks
  const currentUserRoles = userInfo?.roles || [];
  const isAdmin = currentUserRoles.includes('admin') || currentUserRoles.includes('newtown-admin');
  const isSuperAdmin = currentUserRoles.includes('newtown-admin') || currentUserRoles.includes('newtown-staff');

  // Available roles based on company
  const getAvailableRoles = (companyId: number): string[] => {
    const companyName = companies.find(comp => comp.id === companyId)?.name;

    if (companyName === 'Newtown Energy' || companyName === 'Newtown') {
      return ['user', 'staff', 'admin', 'newtown-admin'];
    } else {
      return ['user', 'staff'];
    }
  };

  useEffect(() => {
    if (isAdmin) {
      // Start with just loading companies to avoid complex async issues
      fetchCompanies();
    }
  }, [isAdmin]);

  useEffect(() => {
    // Handle company parameter from URL
    const companyParam = searchParams.get('company');
    if (companyParam && companies.length > 0) {
      const companyId = parseInt(companyParam);
      setSelectedCompanyId(companyId);
    } else if (userInfo && companies.length > 0 && !selectedCompanyId) {
      // Default to user's own company if no parameter provided
      const userCompany = companies.find(comp => comp.name === userInfo.company_name);
      if (userCompany) {
        setSelectedCompanyId(userCompany.id);
      }
    }
  }, [searchParams, companies, userInfo, selectedCompanyId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchUsers(), fetchSites(), fetchCompanies()]);
    } catch (err) {
      setError('Error loading data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/1/users', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        throw new Error('Failed to fetch users');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      // Mock data for development
      setUsers([
        {
          id: 1,
          email: 'admin@example.com',
          company_name: 'Newtown Energy',
          company_id: 1,
          roles: ['admin', 'newtown-admin'],
          created_at: '2024-01-15'
        },
        {
          id: 2,
          email: 'staff@hospital.com',
          company_name: 'NewYork-Presbyterian',
          company_id: 2,
          roles: ['staff'],
          created_at: '2024-02-10'
        },
        {
          id: 3,
          email: 'user@clinic.com',
          company_name: 'Mount Sinai Health System',
          company_id: 3,
          roles: ['user'],
          created_at: '2024-03-05'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSites = async () => {
    try {
      const response = await fetch('/api/1/sites', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSites(data);
      } else {
        throw new Error('Failed to fetch sites');
      }
    } catch (err) {
      console.error('Error fetching sites:', err);
      // Mock data for development
      setSites([
        {
          id: 1,
          name: 'Main Campus',
          location: 'New York, NY',
          company_id: 2,
          company_name: 'NewYork-Presbyterian',
          status: 'Active'
        },
        {
          id: 2,
          name: 'Emergency Center',
          location: 'Brooklyn, NY',
          company_id: 3,
          company_name: 'Mount Sinai Health System',
          status: 'Active'
        }
      ]);
    }
  };

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/1/companies', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setCompanies(data);
      } else {
        throw new Error('Failed to fetch companies');
      }
    } catch (err) {
      console.error('Error fetching companies:', err);
      // Mock data for development
      setCompanies([
        { id: 1, name: 'Newtown Energy' },
        { id: 2, name: 'NewYork-Presbyterian' },
        { id: 3, name: 'Mount Sinai Health System' },
        { id: 4, name: 'NYU Langone Health' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // User management functions
  const handleUserDialog = (user?: User) => {
    setEditingUser(user || null);
    setUserEmail(user?.email || '');
    setUserCompany(user?.company_id || 0);
    setUserRoles(user?.roles || []);
    setUserDialog(true);
  };

  const handleCloseUserDialog = () => {
    setUserDialog(false);
    setEditingUser(null);
    setUserEmail('');
    setUserCompany(0);
    setUserRoles([]);
  };

  const handleSaveUser = async () => {
    if (!userEmail.trim() || !userCompany || userRoles.length === 0) return;

    setLoading(true);
    try {
      const isEdit = editingUser !== null;
      const url = isEdit ? `/api/1/users/${editingUser.id}` : '/api/1/users';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: userEmail,
          company_id: userCompany,
          roles: userRoles
        })
      });

      if (response.ok) {
        await fetchUsers();
        handleCloseUserDialog();
      } else {
        throw new Error(`Failed to ${isEdit ? 'update' : 'create'} user`);
      }
    } catch (err) {
      setError(`Error ${editingUser ? 'updating' : 'creating'} user`);
      console.error('Error saving user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/1/users/${userToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        await fetchUsers();
        setDeleteUserDialog(false);
        setUserToDelete(null);
      } else {
        throw new Error('Failed to delete user');
      }
    } catch (err) {
      setError('Error deleting user');
      console.error('Error deleting user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (userId: number) => {
    // Placeholder - doesn't do anything yet
    console.log('Password reset requested for user:', userId);
    setError('Password reset functionality coming soon');
  };

  // Site management functions
  const handleSiteDialog = (site?: Site) => {
    setEditingSite(site || null);
    setSiteName(site?.name || '');
    setSiteLocation(site?.location || '');
    setSiteCompany(site?.company_id || 0);
    setSiteDialog(true);
  };

  const handleCloseSiteDialog = () => {
    setSiteDialog(false);
    setEditingSite(null);
    setSiteName('');
    setSiteLocation('');
    setSiteCompany(0);
  };

  const handleSaveSite = async () => {
    if (!siteName.trim() || !siteLocation.trim() || !siteCompany) return;

    setLoading(true);
    try {
      const isEdit = editingSite !== null;
      const url = isEdit ? `/api/1/sites/${editingSite.id}` : '/api/1/sites';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: siteName,
          location: siteLocation,
          company_id: siteCompany
        })
      });

      if (response.ok) {
        await fetchSites();
        handleCloseSiteDialog();
      } else {
        throw new Error(`Failed to ${isEdit ? 'update' : 'create'} site`);
      }
    } catch (err) {
      setError(`Error ${editingSite ? 'updating' : 'creating'} site`);
      console.error('Error saving site:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSite = async () => {
    if (!siteToDelete) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/1/sites/${siteToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        await fetchSites();
        setDeleteSiteDialog(false);
        setSiteToDelete(null);
      } else {
        throw new Error('Failed to delete site');
      }
    } catch (err) {
      setError('Error deleting site');
      console.error('Error deleting site:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h2" gutterBottom>
          Admin Panel
        </Typography>
        <Alert severity="error">
          Access denied. You need admin privileges to access this page.
        </Alert>
      </Box>
    );
  }

  const selectedCompanyName = companies.find(comp => comp.id === selectedCompanyId)?.name || 'Select Company';

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h2" gutterBottom>
            Admin Panel
          </Typography>
          {selectedCompanyName !== 'Select Company' && (
            <Typography variant="h6" color="text.secondary">
              {selectedCompanyName}
            </Typography>
          )}
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchData}
          disabled={loading}
        >
          Refresh Data
        </Button>
      </Box>

      {/* Company Selector for Super Admins */}
      {isSuperAdmin && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Company Selection
            </Typography>
            <FormControl fullWidth sx={{ maxWidth: 400 }}>
              <InputLabel>Select Company</InputLabel>
              <Select
                value={selectedCompanyId}
                label="Select Company"
                onChange={(e) => {
                  const newCompanyId = Number(e.target.value);
                  setSelectedCompanyId(newCompanyId);
                  // Update URL parameter
                  const newSearchParams = new URLSearchParams(searchParams);
                  newSearchParams.set('company', newCompanyId.toString());
                  window.history.replaceState(null, '', `?${newSearchParams.toString()}`);
                }}
                disabled={loading}
              >
                <MenuItem value={0}>Select Company</MenuItem>
                {companies.map((company) => (
                  <MenuItem key={company.id} value={company.id}>
                    {company.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {selectedCompanyId === 0 ? (
        <Alert severity="info">
          Please select a company to manage users and sites.
        </Alert>
      ) : (
        <>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
              <Tab icon={<Person />} label="Users" />
              <Tab icon={<LocationOn />} label="Sites" />
            </Tabs>
          </Box>

      {/* Users Tab */}
      {tabValue === 0 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                User Management
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={fetchUsers}
                  disabled={loading}
                >
                  Load Users
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => handleUserDialog()}
                  disabled={loading}
                >
                  Add User
                </Button>
              </Box>
            </Box>

            {loading && users.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Email</TableCell>
                      <TableCell>Company</TableCell>
                      <TableCell>Roles</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.company_name}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {user.roles.map((role) => (
                              <Chip
                                key={role}
                                label={role}
                                size="small"
                                color={role.includes('admin') ? 'primary' : 'default'}
                              />
                            ))}
                          </Box>
                        </TableCell>
                        <TableCell>{user.created_at}</TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleUserDialog(user)}
                            disabled={loading}
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handlePasswordReset(user.id)}
                            disabled={loading}
                            title="Reset Password"
                          >
                            <Refresh />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setUserToDelete(user);
                              setDeleteUserDialog(true);
                            }}
                            disabled={loading}
                            color="error"
                          >
                            <Delete />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && !loading && (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ textAlign: 'center', py: 3 }}>
                          No users found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sites Tab */}
      {tabValue === 1 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Site Management
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={fetchSites}
                  disabled={loading}
                >
                  Load Sites
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => handleSiteDialog()}
                  disabled={loading}
                >
                  Add Site
                </Button>
              </Box>
            </Box>

            {loading && sites.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Site Name</TableCell>
                      <TableCell>Location</TableCell>
                      <TableCell>Company</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sites.map((site) => (
                      <TableRow key={site.id}>
                        <TableCell>{site.name}</TableCell>
                        <TableCell>{site.location}</TableCell>
                        <TableCell>{site.company_name}</TableCell>
                        <TableCell>
                          <Chip
                            label={site.status}
                            size="small"
                            color={site.status === 'Active' ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleSiteDialog(site)}
                            disabled={loading}
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSiteToDelete(site);
                              setDeleteSiteDialog(true);
                            }}
                            disabled={loading}
                            color="error"
                          >
                            <Delete />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {sites.length === 0 && !loading && (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ textAlign: 'center', py: 3 }}>
                          No sites found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* User Add/Edit Dialog */}
      <Dialog open={userDialog} onClose={handleCloseUserDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUser ? 'Edit User' : 'Add User'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Email Address"
              type="email"
              fullWidth
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              disabled={loading}
            />

            <FormControl fullWidth>
              <InputLabel>Company</InputLabel>
              <Select
                value={userCompany}
                label="Company"
                onChange={(e: SelectChangeEvent<number>) => {
                  const companyId = Number(e.target.value);
                  setUserCompany(companyId);
                  // Reset roles when company changes
                  setUserRoles([]);
                }}
                disabled={loading}
              >
                <MenuItem value={0}>Select Company</MenuItem>
                {companies.map((company) => (
                  <MenuItem key={company.id} value={company.id}>
                    {company.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Roles</InputLabel>
              <Select
                multiple
                value={userRoles}
                label="Roles"
                onChange={(e) => {
                  const value = e.target.value;
                  setUserRoles(typeof value === 'string' ? value.split(',') : value);
                }}
                disabled={loading || !userCompany}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {userCompany > 0 && getAvailableRoles(userCompany).map((role) => (
                  <MenuItem key={role} value={role}>
                    {role}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseUserDialog} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveUser}
            variant="contained"
            disabled={loading || !userEmail.trim() || !userCompany || userRoles.length === 0}
          >
            {loading ? <CircularProgress size={20} /> : (editingUser ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Site Add/Edit Dialog */}
      <Dialog open={siteDialog} onClose={handleCloseSiteDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingSite ? 'Edit Site' : 'Add Site'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Site Name"
              fullWidth
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              disabled={loading}
            />

            <TextField
              label="Location"
              fullWidth
              value={siteLocation}
              onChange={(e) => setSiteLocation(e.target.value)}
              disabled={loading}
            />

            <FormControl fullWidth>
              <InputLabel>Company</InputLabel>
              <Select
                value={siteCompany}
                label="Company"
                onChange={(e: SelectChangeEvent<number>) => {
                  setSiteCompany(Number(e.target.value));
                }}
                disabled={loading}
              >
                <MenuItem value={0}>Select Company</MenuItem>
                {companies.map((company) => (
                  <MenuItem key={company.id} value={company.id}>
                    {company.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSiteDialog} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveSite}
            variant="contained"
            disabled={loading || !siteName.trim() || !siteLocation.trim() || !siteCompany}
          >
            {loading ? <CircularProgress size={20} /> : (editingSite ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={deleteUserDialog} onClose={() => setDeleteUserDialog(false)}>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the user "{userToDelete?.email}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteUserDialog(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteUser}
            color="error"
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Site Confirmation Dialog */}
      <Dialog open={deleteSiteDialog} onClose={() => setDeleteSiteDialog(false)}>
        <DialogTitle>Delete Site</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the site "{siteToDelete?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteSiteDialog(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteSite}
            color="error"
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
        </>
      )}
    </Box>
  );
};

export default AdminPage;