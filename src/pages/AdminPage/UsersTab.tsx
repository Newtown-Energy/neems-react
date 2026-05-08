import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { Add, Delete, Edit, Refresh } from '@mui/icons-material';
import type {
  Company,
  CompanyWithTimestamps,
  CreateUserWithRolesRequest,
  UpdateUserRequest,
  UserWithRolesAndTimestamps
} from '@newtown-energy/types';
import { ApiError, apiRequestWithMapping } from '../../utils/api';
import type { ODataQueryOptions } from '../../utils/api';
import { debugLog, errorLog } from '../../utils/debug';

type UserWithExpandedCompany = UserWithRolesAndTimestamps & { Company?: Company };

const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  return diffInHours > 24 ? date.toLocaleDateString() : date.toLocaleTimeString();
};

interface UsersTabProps {
  selectedCompanyId: number;
  selectedCompanyName: string;
  companies: CompanyWithTimestamps[];
}

const UsersTab: React.FC<UsersTabProps> = ({ selectedCompanyId, selectedCompanyName, companies }) => {
  const [users, setUsers] = useState<UserWithRolesAndTimestamps[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userDialog, setUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRolesAndTimestamps | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userCompany, setUserCompany] = useState<number>(0);
  const [userRole, setUserRole] = useState<string>('');
  const [deleteUserDialog, setDeleteUserDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRolesAndTimestamps | null>(null);
  const [userModalError, setUserModalError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCompanyId > 0) {
      fetchUsers();
    } else {
      setUsers([]);
    }
  }, [selectedCompanyId]);

  const getAvailableRoles = (companyId: number): string[] => {
    const companyName = companies.find(comp => comp.id === companyId)?.name;
    if (companyName === 'Newtown Energy' || companyName === 'Newtown') {
      return ['staff', 'admin', 'newtown-admin'];
    }
    return ['staff', 'admin'];
  };

  const fetchUsers = async () => {
    if (!selectedCompanyId) {
      setUsers([]);
      return;
    }

    debugLog('UsersTab: Fetching users', { companyId: selectedCompanyId });
    setLoading(true);
    setError(null);
    try {
      const queryOptions: ODataQueryOptions = { $expand: 'Company' };
      const data = await apiRequestWithMapping<UserWithExpandedCompany[]>(
        `/api/1/Companies/${selectedCompanyId}/Users`,
        {},
        queryOptions
      );
      const usersWithCompanyNames = data.map((user) => ({
        ...user,
        company_name: user.Company?.name || companies.find(c => c.id === user.company_id)?.name || 'Unknown'
      }));
      setUsers(usersWithCompanyNames);
    } catch (err) {
      errorLog('Error fetching users:', err);
      setError(err instanceof ApiError ? `Failed to load users: ${err.message}` : 'Failed to load users for this company');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserDialog = (user?: UserWithRolesAndTimestamps) => {
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
      if (editingUser) {
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
      } else {
        const requestBody: CreateUserWithRolesRequest = {
          email: userEmail,
          password_hash: 'temp_password_hash',
          company_id: userCompany,
          totp_secret: null,
          role_names: [userRole]
        };
        await apiRequestWithMapping('/api/1/Users', {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });
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
      errorLog('Error saving user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setLoading(true);
    try {
      await apiRequestWithMapping(`/api/1/Users/${userToDelete.id}`, { method: 'DELETE' });
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
      errorLog('Error deleting user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = (userId: number) => {
    debugLog('Password reset requested for user:', userId);
    setUserModalError('Password reset functionality coming soon');
  };

  return (
    <>
      {error && !userDialog && !deleteUserDialog && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">User Management</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" startIcon={<Refresh />} onClick={fetchUsers} disabled={loading}>
                Load Users
              </Button>
              <Button variant="contained" startIcon={<Add />} onClick={() => handleUserDialog()} disabled={loading}>
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
                        <IconButton size="small" onClick={() => handleUserDialog(user)} disabled={loading}>
                          <Edit />
                        </IconButton>
                        <IconButton size="small" onClick={() => handlePasswordReset(user.id)} disabled={loading} title="Reset Password">
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
                onChange={(e) => setUserRole(e.target.value)}
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
    </>
  );
};

export default UsersTab;
