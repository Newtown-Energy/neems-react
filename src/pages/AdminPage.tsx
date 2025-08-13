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
  Link,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio
} from '@mui/material';
import { Add, Edit, Delete, Refresh, Person, LocationOn, Business, AdminPanelSettings } from '@mui/icons-material';
import { useAuth } from './LoginPage/useAuth';
import { useSearchParams } from 'react-router-dom';
import type { User } from '../types/generated/User';
import type { UserWithRoles } from '../types/generated/UserWithRoles';
import type { Site } from '../types/generated/Site';
import type { Company } from '../types/generated/Company';
import type { CreateUserWithRolesRequest } from '../types/generated/CreateUserWithRolesRequest';
import type { UpdateUserRequest } from '../types/generated/UpdateUserRequest';
import type { CreateSiteRequest } from '../types/generated/CreateSiteRequest';
import { apiRequest, apiRequestWithMapping, apiRequestODataWithCount, ApiError, ODataQueryOptions } from '../utils/api';





const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours > 24) {
    return date.toLocaleDateString();
  } else {
    return date.toLocaleTimeString();
  }
};


const AdminPage: React.FC = () => {
  const { userInfo } = useAuth();
  const [searchParams] = useSearchParams();
  const [tabValue, setTabValue] = useState(0);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(0);
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User management state
  const [userDialog, setUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userCompany, setUserCompany] = useState<number>(0);
  const [userRole, setUserRole] = useState<string>('');
  const [deleteUserDialog, setDeleteUserDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRoles | null>(null);
  const [userModalError, setUserModalError] = useState<string | null>(null);

  // Site management state
  const [siteDialog, setSiteDialog] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [siteName, setSiteName] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [siteCompany, setSiteCompany] = useState<number>(0);
  const [deleteSiteDialog, setDeleteSiteDialog] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<Site | null>(null);
  const [siteModalError, setSiteModalError] = useState<string | null>(null);

  // Company management state
  const [companyDialog, setCompanyDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [deleteCompanyDialog, setDeleteCompanyDialog] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [companyModalError, setCompanyModalError] = useState<string | null>(null);

  // Role checks
  const currentUserRoles = userInfo?.roles || [];
  const isAdmin = currentUserRoles.includes('admin') || currentUserRoles.includes('newtown-admin');
  const isSuperAdmin = currentUserRoles.includes('newtown-admin') || currentUserRoles.includes('newtown-staff');

  // Available roles based on company
  const getAvailableRoles = (companyId: number): string[] => {
    const companyName = companies.find(comp => comp.id === companyId)?.name;

    if (companyName === 'Newtown Energy' || companyName === 'Newtown') {
      return ['staff', 'admin', 'newtown-admin'];
    } else {
      return ['staff', 'admin'];
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
    } else if (companies.length > 0 && selectedCompanyId === 0) {
      // Default to user's own company if no parameter provided
      if (userInfo && userInfo.company_name) {
        const userCompany = companies.find(comp => comp.name === userInfo.company_name);
        if (userCompany) {
          setSelectedCompanyId(userCompany.id);
        } else if (companies.length > 0) {
          // Fallback to first company if user's company not found
          setSelectedCompanyId(companies[0].id);
        }
      } else if (companies.length > 0) {
        // Fallback to first company if no user info
        setSelectedCompanyId(companies[0].id);
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


  const fetchUsers = async () => {
    if (!selectedCompanyId) {
      setUsers([]);
      return;
    }

    setLoading(true);
    try {
      // Use OData $expand to include company information
      const queryOptions: ODataQueryOptions = {
        $expand: 'Company',
        // Other OData options that could be used:
        // $select: 'id,email,company_id', // Select specific fields
        // $filter: "startswith(email,'admin')", // Filter by email starting with 'admin'
        // $orderby: 'email desc', // Order by email descending  
        // $top: 50, // Limit to 50 users
        // $skip: 0, // Skip 0 users (for pagination)
        // $count: true // Include total count in response
      };
      const data = await apiRequestWithMapping<User[]>(`/api/1/Companies/${selectedCompanyId}/Users`, {}, queryOptions);
      // Transform API response - roles are now embedded, company may be expanded
      const usersWithCompanyNames = data.map((user: any) => ({
        ...user,
        company_name: (user.Company?.name) || companies.find(c => c.id === user.company_id)?.name || 'Unknown'
      }));
      setUsers(usersWithCompanyNames);
    } catch (err) {
      console.error('Error fetching users:', err);
      if (err instanceof ApiError) {
        setError(`Failed to load users: ${err.message}`);
      } else {
        setError('Failed to load users for this company');
      }
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
      const data = await apiRequestWithMapping<Site[]>(`/api/1/Companies/${selectedCompanyId}/Sites`);
      // Transform API response to match our interface
      const transformedSites = data.map((site: any) => ({
        ...site,
        location: site.address || `${site.latitude}, ${site.longitude}`,
        company_name: companies.find(c => c.id === site.company_id)?.name || 'Unknown',
        status: 'Active' // Default status since API doesn't provide this
      }));
      setSites(transformedSites);
    } catch (err) {
      console.error('Error fetching sites:', err);
      if (err instanceof ApiError) {
        setError(`Failed to load sites: ${err.message}`);
      } else {
        setError('Failed to load sites for this company');
      }
      setSites([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      // Use OData query options to get ordered results with count
      const queryOptions: ODataQueryOptions = {
        $orderby: 'name',
        $count: true
      };
      const data = await apiRequestWithMapping<Company[]>('/api/1/Companies', {}, queryOptions);
      setCompanies(data);
    } catch (err) {
      console.error('Error fetching companies:', err);
      if (err instanceof ApiError) {
        setError(`Failed to load companies: ${err.message}`);
      }
      // Mock data for development
      setCompanies([
        { id: 1, name: 'Newtown Energy', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
        { id: 2, name: 'NewYork-Presbyterian', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
        { id: 3, name: 'Mount Sinai Health System', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
        { id: 4, name: 'NYU Langone Health', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // User management functions
  const handleUserDialog = (user?: UserWithRoles) => {
    setEditingUser(user || null);
    setUserEmail(user?.email || '');
    setUserCompany(user?.company_id || selectedCompanyId);
    setUserRole(user?.roles?.[0]?.name || '');
    setUserModalError(null);
    setUserDialog(true);
  };

  const handleCloseUserDialog = () => {
    setUserDialog(false);
    setEditingUser(null);
    setUserEmail('');
    setUserCompany(0);
    setUserRole('');
    setUserModalError(null);
  };

  const handleSaveUser = async () => {
    if (!userEmail.trim() || !userCompany || !userRole.trim()) return;

    setLoading(true);
    try {
      const isEdit = editingUser !== null;

      if (isEdit) {
        // For editing, update user basic info first
        const requestBody: UpdateUserRequest = {
          email: userEmail,
          password_hash: null,
          company_id: userCompany,
          totp_secret: null
        };
        await apiRequestWithMapping(`/api/1/Users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(requestBody)
        });

        // Note: Role management would need separate API calls to add/remove roles
        // This is a simplified version for now
      } else {
        // For creating, we need a password_hash and role_names
        const requestBody: CreateUserWithRolesRequest = {
          email: userEmail,
          password_hash: 'temp_password_hash', // This should be properly hashed
          company_id: userCompany,
          totp_secret: null,
          role_names: [userRole]
        };
        await apiRequestWithMapping('/api/1/Users', {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });

        // Note: Role assignment would need separate API calls
      }

      await fetchUsers();
      handleCloseUserDialog();
    } catch (err) {
      let errorMessage: string;
      if (err instanceof ApiError) {
        errorMessage = err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else {
        errorMessage = `Error ${editingUser ? 'updating' : 'creating'} user`;
      }
      setUserModalError(errorMessage);
      console.error('Error saving user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setLoading(true);
    try {
      await apiRequestWithMapping(`/api/1/Users/${userToDelete.id}`, {
        method: 'DELETE'
      });
      await fetchUsers();
      setDeleteUserDialog(false);
      setUserToDelete(null);
    } catch (err) {
      let errorMessage: string;
      if (err instanceof ApiError) {
        errorMessage = err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else {
        errorMessage = 'Error deleting user';
      }
      setUserModalError(errorMessage);
      console.error('Error deleting user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (userId: number) => {
    // Placeholder - doesn't do anything yet
    console.log('Password reset requested for user:', userId);
    setUserModalError('Password reset functionality coming soon');
  };

  // Site management functions
  const handleSiteDialog = (site?: Site) => {
    setEditingSite(site || null);
    setSiteName(site?.name || '');
    setSiteLocation(site?.address || '');
    setSiteCompany(site?.company_id || selectedCompanyId);
    setSiteModalError(null);
    setSiteDialog(true);
  };

  const handleCloseSiteDialog = () => {
    setSiteDialog(false);
    setEditingSite(null);
    setSiteName('');
    setSiteLocation('');
    setSiteCompany(selectedCompanyId);
    setSiteModalError(null);
  };

  const handleSaveSite = async () => {
    if (!siteName.trim() || !siteLocation.trim()) return;

    setLoading(true);
    try {
      const isEdit = editingSite !== null;
      const url = isEdit ? `/api/1/Sites/${editingSite.id}` : '/api/1/Sites';
      const method = isEdit ? 'PUT' : 'POST';

      const requestBody: CreateSiteRequest = {
        name: siteName,
        address: siteLocation,
        latitude: 0, // Default values - would need proper geocoding
        longitude: 0,
        company_id: siteCompany || selectedCompanyId
      };
      await apiRequestWithMapping(url, {
        method,
        body: JSON.stringify(requestBody)
      });
      await fetchSites();
      handleCloseSiteDialog();
    } catch (err) {
      let errorMessage: string;
      if (err instanceof ApiError) {
        errorMessage = err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else {
        errorMessage = `Error ${editingSite ? 'updating' : 'creating'} site`;
      }
      setSiteModalError(errorMessage);
      console.error('Error saving site:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSite = async () => {
    if (!siteToDelete) return;

    setLoading(true);
    try {
      await apiRequestWithMapping(`/api/1/Sites/${siteToDelete.id}`, {
        method: 'DELETE'
      });
      await fetchSites();
      setDeleteSiteDialog(false);
      setSiteToDelete(null);
    } catch (err) {
      let errorMessage: string;
      if (err instanceof ApiError) {
        errorMessage = err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else {
        errorMessage = 'Error deleting site';
      }
      setSiteModalError(errorMessage);
      console.error('Error deleting site:', err);
    } finally {
      setLoading(false);
    }
  };

  // Company management functions
  const handleCompanyDialog = (company?: Company) => {
    setEditingCompany(company || null);
    setCompanyName(company?.name || '');
    setCompanyModalError(null);
    setCompanyDialog(true);
  };

  const handleCloseCompanyDialog = () => {
    setCompanyDialog(false);
    setEditingCompany(null);
    setCompanyName('');
    setCompanyModalError(null);
  };

  const handleSaveCompany = async () => {
    if (!companyName.trim()) return;

    setLoading(true);
    try {
      const isEdit = editingCompany !== null;
      const url = isEdit ? `/api/1/Companies/${editingCompany.id}` : '/api/1/Companies';
      const method = isEdit ? 'PUT' : 'POST';

      await apiRequestWithMapping(url, {
        method,
        body: JSON.stringify({ name: companyName })
      });
      await fetchCompanies();
      handleCloseCompanyDialog();
    } catch (err) {
      let errorMessage: string;
      if (err instanceof ApiError) {
        errorMessage = err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else {
        errorMessage = `Error ${editingCompany ? 'updating' : 'creating'} company`;
      }
      setCompanyModalError(errorMessage);
      console.error('Error saving company:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!companyToDelete) return;

    setLoading(true);
    try {
      await apiRequestWithMapping(`/api/1/Companies/${companyToDelete.id}`, {
        method: 'DELETE'
      });
      await fetchCompanies();
      setDeleteCompanyDialog(false);
      setCompanyToDelete(null);
    } catch (err) {
      let errorMessage: string;
      if (err instanceof ApiError) {
        errorMessage = err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else {
        errorMessage = 'Error deleting company';
      }
      setCompanyModalError(errorMessage);
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
            {selectedCompanyName !== 'Select Company' ? `${selectedCompanyName} Admin Panel` : 'Admin Panel'}
          </Typography>
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


      {error && !userDialog && !siteDialog && !companyDialog && !deleteUserDialog && !deleteSiteDialog && !deleteCompanyDialog && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {selectedCompanyId > 0 && (
        <>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
              <Tab icon={<Person />} label="Users" />
              <Tab icon={<LocationOn />} label="Sites" />
              {isSuperAdmin && (
                <Tab icon={<Business />} label="COMPANIES" />
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
                        <TableCell>{companies.find(c => c.id === user.company_id)?.name || 'Unknown'}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {user.roles?.map((role) => (
                              <Chip
                                key={role.id}
                                label={role.name}
                                size="small"
                                color={role.name.includes('admin') ? 'primary' : 'default'}
                              />
                            ))}
                          </Box>
                        </TableCell>
                        <TableCell>{formatDateTime(user.created_at)}</TableCell>
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
                        <TableCell>{site.address}</TableCell>
                        <TableCell>{companies.find(c => c.id === site.company_id)?.name || 'Unknown'}</TableCell>
                        <TableCell>
                          <Chip
                            label="Active"
                            size="small"
                            color="success"
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
                COMPANIES
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
          {editingUser ? 'Edit User' : `Add ${selectedCompanyName} User`}
        </DialogTitle>
        <DialogContent>
          {userModalError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {userModalError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Email Address"
              type="email"
              fullWidth
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              disabled={loading}
            />

            <FormControl component="fieldset" fullWidth>
              <FormLabel component="legend">Role</FormLabel>
              <RadioGroup
                value={userRole}
                onChange={(e) => {
                  setUserRole(e.target.value);
                }}
                row
                sx={{ mt: 1 }}
              >
                {userCompany > 0 && getAvailableRoles(userCompany).map((role) => (
                  <FormControlLabel
                    key={role}
                    value={role}
                    control={<Radio disabled={loading} />}
                    label={role.charAt(0).toUpperCase() + role.slice(1)}
                  />
                ))}
              </RadioGroup>
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
            disabled={loading || !userEmail.trim() || !userCompany || !userRole.trim()}
          >
            {loading ? <CircularProgress size={20} /> : (editingUser ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Site Add/Edit Dialog */}
      <Dialog open={siteDialog} onClose={handleCloseSiteDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingSite ? 'Edit Site' : `Add ${selectedCompanyName} Site`}
        </DialogTitle>
        <DialogContent>
          {siteModalError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {siteModalError}
            </Alert>
          )}
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSiteDialog} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveSite}
            variant="contained"
            disabled={loading || !siteName.trim() || !siteLocation.trim()}
          >
            {loading ? <CircularProgress size={20} /> : (editingSite ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={deleteUserDialog} onClose={() => setDeleteUserDialog(false)}>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          {userModalError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {userModalError}
            </Alert>
          )}
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
          {siteModalError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {siteModalError}
            </Alert>
          )}
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
          {companyModalError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {companyModalError}
            </Alert>
          )}
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
          {companyModalError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {companyModalError}
            </Alert>
          )}
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