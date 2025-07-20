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
  Link
} from '@mui/material';
import { Add, Edit, Delete, AdminPanelSettings } from '@mui/icons-material';
import { useAuth } from '../components/LoginPage/useAuth';
import { useNavigate } from 'react-router-dom';

interface Institution {
  id: number;
  name: string;
  status: string;
  userCount: number;
}

const SuperAdminPage: React.FC = () => {
  const { userInfo } = useAuth();
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingInstitution, setEditingInstitution] = useState<Institution | null>(null);
  const [institutionName, setInstitutionName] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [institutionToDelete, setInstitutionToDelete] = useState<Institution | null>(null);

  // Role checks
  const userRoles = userInfo?.roles || [];
  const isNewtownAdmin = userRoles.includes('newtown-admin');
  const isNewtownStaff = userRoles.includes('newtown-staff');
  const hasAccess = isNewtownAdmin || isNewtownStaff;

  useEffect(() => {
    if (hasAccess) {
      fetchInstitutions();
    }
  }, [hasAccess]);

  const fetchInstitutions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/1/institutions', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setInstitutions(data);
      } else {
        throw new Error('Failed to fetch institutions');
      }
    } catch (err) {
      setError('Error loading institutions');
      console.error('Error fetching institutions:', err);
      // Mock data for development
      setInstitutions([
        { id: 1, name: 'NewYork-Presbyterian', status: 'Active', userCount: 15 },
        { id: 2, name: 'Mount Sinai Health System', status: 'Active', userCount: 8 },
        { id: 3, name: 'NYU Langone Health', status: 'Inactive', userCount: 0 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (institution?: Institution) => {
    setEditingInstitution(institution || null);
    setInstitutionName(institution?.name || '');
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingInstitution(null);
    setInstitutionName('');
  };

  const handleSaveInstitution = async () => {
    if (!institutionName.trim()) return;

    setLoading(true);
    try {
      const isEdit = editingInstitution !== null;
      const url = isEdit ? `/api/1/institutions/${editingInstitution.id}` : '/api/1/institutions';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: institutionName })
      });

      if (response.ok) {
        await fetchInstitutions();
        handleCloseDialog();
      } else {
        throw new Error(`Failed to ${isEdit ? 'update' : 'create'} institution`);
      }
    } catch (err) {
      setError(`Error ${editingInstitution ? 'updating' : 'creating'} institution`);
      console.error('Error saving institution:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (institution: Institution) => {
    setInstitutionToDelete(institution);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!institutionToDelete) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/1/institutions/${institutionToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        await fetchInstitutions();
        setDeleteConfirmOpen(false);
        setInstitutionToDelete(null);
      } else {
        throw new Error('Failed to delete institution');
      }
    } catch (err) {
      setError('Error deleting institution');
      console.error('Error deleting institution:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h2" gutterBottom>
          Super Admin
        </Typography>
        <Alert severity="error">
          Access denied. You need newtown-admin or newtown-staff role to access this page.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h2" gutterBottom>
          Super Admin
        </Typography>
        {isNewtownAdmin && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            disabled={loading}
          >
            Add Institution
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Institution Management
          </Typography>
          {loading && institutions.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Institution Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Users</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {institutions.map((institution) => (
                    <TableRow key={institution.id}>
                      <TableCell>
                        <Link
                          component="button"
                          variant="body2"
                          onClick={() => navigate(`/admin?institution=${institution.id}`)}
                          sx={{
                            textDecoration: 'none',
                            color: 'primary.main',
                            fontWeight: 'medium',
                            '&:hover': {
                              textDecoration: 'underline'
                            }
                          }}
                        >
                          {institution.name}
                        </Link>
                      </TableCell>
                      <TableCell>{institution.status}</TableCell>
                      <TableCell>{institution.userCount}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/admin?institution=${institution.id}`)}
                          disabled={loading}
                          title={`Admin Panel for ${institution.name}`}
                          color="primary"
                        >
                          <AdminPanelSettings />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(institution)}
                          disabled={loading}
                          title="Edit Institution"
                        >
                          <Edit />
                        </IconButton>
                        {isNewtownAdmin && (
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteClick(institution)}
                            disabled={loading || institution.userCount > 0}
                            color="error"
                            title="Delete Institution"
                          >
                            <Delete />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {institutions.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ textAlign: 'center', py: 3 }}>
                        No institutions found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingInstitution ? 'Edit Institution' : 'Add Institution'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Institution Name"
              fullWidth
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              disabled={loading}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveInstitution}
            variant="contained"
            disabled={loading || !institutionName.trim()}
          >
            {loading ? <CircularProgress size={20} /> : (editingInstitution ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Institution</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{institutionToDelete?.name}"?
            {institutionToDelete && institutionToDelete.userCount > 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                This institution has {institutionToDelete.userCount} users. Please reassign users before deleting.
              </Alert>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={loading || (institutionToDelete?.userCount ?? 0) > 0}
          >
            {loading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SuperAdminPage;