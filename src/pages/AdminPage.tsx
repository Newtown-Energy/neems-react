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
  Tab,
  Link
} from '@mui/material';
import { Add, Edit, Delete, Refresh, Person, LocationOn, Business, AdminPanelSettings } from '@mui/icons-material';
import { useAuth } from '../components/LoginPage/useAuth';
import { useSearchParams, useNavigate } from 'react-router-dom';
import type { SelectChangeEvent } from '@mui/material';

interface User {
  id: number;
  email: string;
  password_hash: string;
  company_id: number;
  company_name?: string; // Added by transformation
  totp_secret?: string | null;
  roles?: string[]; // Added by transformation
  created_at: string;
  updated_at: string;
}

interface Site {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  company_id: number;
  company_name?: string; // Added by transformation
  location?: string; // Added by transformation for display
  status?: string; // Added by transformation
  created_at: string;
  updated_at: string;
}

interface Company {
  id: number;
  name: string;
}

const AdminPage: React.FC = () => {
  const { userInfo } = useAuth();
  const navigate = useNavigate();
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

  // Company management state
  const [companyDialog, setCompanyDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [deleteCompanyDialog, setDeleteCompanyDialog] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

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
      fetchCompanies();
    }
  }, [isAdmin]);

  useEffect(() => {
    // Load users and sites when selectedCompanyId changes
    if (selectedCompanyId > 0) {
      fetchUsers();
      fetchSites();
    }
  }, [selectedCompanyId]);

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
      await fetchCompanies();
      if (selectedCompanyId > 0) {
        await Promise.all([fetchUsers(), fetchSites()]);
      }
    } catch (err) {
      setError('Error loading data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRoles = async (userId: number): Promise<string[]> => {
    try {
      const response = await fetch(`/api/1/users/${userId}/roles`, {
        credentials: 'include'
      });
      if (response.ok) {
        const roles = await response.json();
        return roles.map((role: any) => role.name);
      }
    } catch (err) {
      console.error(`Error fetching roles for user ${userId}:`, err);
    }
    return [];
  };

  const fetchUsers = async () => {
    if (!selectedCompanyId) {
      setUsers([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/1/company/${selectedCompanyId}/users`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        // Transform API response and fetch roles for each user
        const usersWithRoles = await Promise.all(
          data.map(async (user: any) => {
            const roles = await fetchUserRoles(user.id);
            return {
              ...user,
              company_name: companies.find(c => c.id === user.company_id)?.name || 'Unknown',
              roles
            };
          })
        );
        setUsers(usersWithRoles);
      } else {
        throw new Error('Failed to fetch users');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users for this company');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSites = async () => {
    if (!selectedCompanyId) {
      setSites([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/1/company/${selectedCompanyId}/sites`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        // Transform API response to match our interface
        const transformedSites = data.map((site: any) => ({
          ...site,
          location: site.address || `${site.latitude}, ${site.longitude}`,
          company_name: companies.find(c => c.id === site.company_id)?.name || 'Unknown',
          status: 'Active' // Default status since API doesn't provide this
        }));
        setSites(transformedSites);
      } else {
        throw new Error('Failed to fetch sites');
      }
    } catch (err) {
      console.error('Error fetching sites:', err);
      setError('Failed to load sites for this company');
      setSites([]);
    } finally {
      setLoading(false);
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
      
      if (isEdit) {
        // For editing, update user basic info first
        const updateResponse = await fetch(`/api/1/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: userEmail,
            company_id: userCompany
          })
        });
        
        if (!updateResponse.ok) {
          throw new Error('Failed to update user');
        }
        
        // Note: Role management would need separate API calls to add/remove roles
        // This is a simplified version for now
      } else {
        // For creating, we need a password_hash (this is a limitation)
        const createResponse = await fetch('/api/1/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: userEmail,
            password_hash: 'temp_password_hash', // This should be properly hashed
            company_id: userCompany
          })
        });
        
        if (!createResponse.ok) {
          throw new Error('Failed to create user');
        }
        
        // Note: Role assignment would need separate API calls
      }

      await fetchUsers();
      handleCloseUserDialog();
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
    setSiteLocation(site?.location || site?.address || '');
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
          address: siteLocation, // Use 'address' instead of 'location'
          latitude: 0, // Default values - would need proper geocoding
          longitude: 0,
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

  // Company management functions
  const handleCompanyDialog = (company?: Company) => {
    setEditingCompany(company || null);
    setCompanyName(company?.name || '');
    setCompanyDialog(true);
  };

  const handleCloseCompanyDialog = () => {
    setCompanyDialog(false);
    setEditingCompany(null);
    setCompanyName('');
  };

  const handleSaveCompany = async () => {
    if (!companyName.trim()) return;

    setLoading(true);
    try {
      const isEdit = editingCompany !== null;
      const url = isEdit ? `/api/1/companies/${editingCompany.id}` : '/api/1/companies';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: companyName })
      });

      if (response.ok) {
        await fetchCompanies();
        handleCloseCompanyDialog();
      } else {
        throw new Error(`Failed to ${isEdit ? 'update' : 'create'} company`);
      }
    } catch (err) {
      setError(`Error ${editingCompany ? 'updating' : 'creating'} company`);
      console.error('Error saving company:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!companyToDelete) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/1/companies/${companyToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        await fetchCompanies();
        setDeleteCompanyDialog(false);
        setCompanyToDelete(null);
      } else {
        throw new Error('Failed to delete company');
      }
    } catch (err) {
      setError('Error deleting company');
      console.error('Error deleting company:', err);
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
              {isSuperAdmin && (
                <Tab icon={<Business />} label="Company Add/Remove/Edit" />
              )}
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
                        <TableCell>{site.location || site.address}</TableCell>
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

      {/* Companies Tab - Only for Super Admins */}
      {tabValue === 2 && isSuperAdmin && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Company Add/Remove/Edit
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={fetchCompanies}
                  disabled={loading}
                >
                  Refresh Companies
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => handleCompanyDialog()}
                  disabled={loading}
                >
                  Add Company
                </Button>
              </Box>
            </Box>

            {loading && companies.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Company Name</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {companies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell>
                          <Link
                            component="button"
                            variant="body2"
                            onClick={() => {
                              setSelectedCompanyId(company.id);
                              setTabValue(0); // Switch to Users tab
                              // Update URL parameter
                              const newSearchParams = new URLSearchParams(searchParams);
                              newSearchParams.set('company', company.id.toString());
                              window.history.replaceState(null, '', `?${newSearchParams.toString()}`);
                            }}
                            sx={{
                              textDecoration: 'none',
                              color: 'primary.main',
                              fontWeight: 'medium',
                              '&:hover': {
                                textDecoration: 'underline'
                              }
                            }}
                          >
                            {company.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedCompanyId(company.id);
                              setTabValue(0); // Switch to Users tab
                              // Update URL parameter
                              const newSearchParams = new URLSearchParams(searchParams);
                              newSearchParams.set('company', company.id.toString());
                              window.history.replaceState(null, '', `?${newSearchParams.toString()}`);
                            }}
                            disabled={loading}
                            title={`Admin Panel for ${company.name}`}
                            color="primary"
                          >
                            <AdminPanelSettings />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleCompanyDialog(company)}
                            disabled={loading}
                            title="Edit Company"
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setCompanyToDelete(company);
                              setDeleteCompanyDialog(true);
                            }}
                            disabled={loading}
                            color="error"
                            title="Delete Company"
                          >
                            <Delete />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {companies.length === 0 && !loading && (
                      <TableRow>
                        <TableCell colSpan={2} sx={{ textAlign: 'center', py: 3 }}>
                          No companies found
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

      {/* Company Add/Edit Dialog */}
      <Dialog open={companyDialog} onClose={handleCloseCompanyDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCompany ? 'Edit Company' : 'Add Company'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Company Name"
              fullWidth
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={loading}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCompanyDialog} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveCompany}
            variant="contained"
            disabled={loading || !companyName.trim()}
          >
            {loading ? <CircularProgress size={20} /> : (editingCompany ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Company Confirmation Dialog */}
      <Dialog open={deleteCompanyDialog} onClose={() => setDeleteCompanyDialog(false)}>
        <DialogTitle>Delete Company</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the company "{companyToDelete?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteCompanyDialog(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteCompany}
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