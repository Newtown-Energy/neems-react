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

interface Company {
  id: number;
  name: string;
  status: string;
  userCount: number;
}

const SuperAdminPage: React.FC = () => {
  const { userInfo } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

  // Role checks
  const userRoles = userInfo?.roles || [];
  const isNewtownAdmin = userRoles.includes('newtown-admin');
  const isNewtownStaff = userRoles.includes('newtown-staff');
  const hasAccess = isNewtownAdmin || isNewtownStaff;

  useEffect(() => {
    if (hasAccess) {
      fetchCompanies();
    }
  }, [hasAccess]);

  const fetchCompanies = async () => {
    setLoading(true);
    setError(null);
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
      setError('Error loading companies');
      console.error('Error fetching companies:', err);
      // Mock data for development
      setCompanies([
        { id: 1, name: 'NewYork-Presbyterian', status: 'Active', userCount: 15 },
        { id: 2, name: 'Mount Sinai Health System', status: 'Active', userCount: 8 },
        { id: 3, name: 'NYU Langone Health', status: 'Inactive', userCount: 0 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (company?: Company) => {
    setEditingCompany(company || null);
    setCompanyName(company?.name || '');
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
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
        handleCloseDialog();
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

  const handleDeleteClick = (company: Company) => {
    setCompanyToDelete(company);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!companyToDelete) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/1/companies/${companyToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        await fetchCompanies();
        setDeleteConfirmOpen(false);
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
            Add Company
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
            Company Management
          </Typography>
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
                    <TableCell>Status</TableCell>
                    <TableCell>Users</TableCell>
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
                          onClick={() => navigate(`/admin?company=${company.id}`)}
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
                      <TableCell>{company.status}</TableCell>
                      <TableCell>{company.userCount}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/admin?company=${company.id}`)}
                          disabled={loading}
                          title={`Admin Panel for ${company.name}`}
                          color="primary"
                        >
                          <AdminPanelSettings />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(company)}
                          disabled={loading}
                          title="Edit Company"
                        >
                          <Edit />
                        </IconButton>
                        {isNewtownAdmin && (
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteClick(company)}
                            disabled={loading || company.userCount > 0}
                            color="error"
                            title="Delete Company"
                          >
                            <Delete />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {companies.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ textAlign: 'center', py: 3 }}>
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

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
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
          <Button onClick={handleCloseDialog} disabled={loading}>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Company</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{companyToDelete?.name}"?
            {companyToDelete && companyToDelete.userCount > 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                This company has {companyToDelete.userCount} users. Please reassign users before deleting.
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
            disabled={loading || (companyToDelete?.userCount ?? 0) > 0}
          >
            {loading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SuperAdminPage;