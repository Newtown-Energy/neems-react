import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { Add, AdminPanelSettings, Delete, Edit, Refresh } from '@mui/icons-material';
import type { CompanyWithTimestamps } from '@newtown-energy/types';
import { ApiError, apiRequestWithMapping } from '../../utils/api';
import { errorLog } from '../../utils/debug';

interface CompaniesTabProps {
  companies: CompanyWithTimestamps[];
  loading: boolean;
  onSelectCompany: (companyId: number) => void;
  onCompaniesChanged: () => Promise<void> | void;
  onRefreshCompanies: () => void;
}

const CompaniesTab: React.FC<CompaniesTabProps> = ({
  companies,
  loading,
  onSelectCompany,
  onCompaniesChanged,
  onRefreshCompanies
}) => {
  const [companyDialog, setCompanyDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyWithTimestamps | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [deleteCompanyDialog, setDeleteCompanyDialog] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<CompanyWithTimestamps | null>(null);
  const [companyModalError, setCompanyModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCompanyDialog = (company?: CompanyWithTimestamps) => {
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

    setSaving(true);
    try {
      const url = editingCompany ? `/api/1/Companies/${editingCompany.id}` : '/api/1/Companies';
      const method = editingCompany ? 'PUT' : 'POST';

      await apiRequestWithMapping(url, {
        method,
        body: JSON.stringify({ name: companyName })
      });
      await onCompaniesChanged();
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
      errorLog('Error saving company:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!companyToDelete) return;

    setSaving(true);
    try {
      await apiRequestWithMapping(`/api/1/Companies/${companyToDelete.id}`, { method: 'DELETE' });
      await onCompaniesChanged();
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
      errorLog('Error deleting company:', err);
    } finally {
      setSaving(false);
    }
  };

  const busy = loading || saving;

  return (
    <>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">COMPANIES</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" startIcon={<Refresh />} onClick={onRefreshCompanies} disabled={busy}>
                Refresh Companies
              </Button>
              <Button variant="contained" startIcon={<Add />} onClick={() => handleCompanyDialog()} disabled={busy}>
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
                          onClick={() => onSelectCompany(company.id)}
                          sx={{
                            textDecoration: 'none',
                            color: 'primary.main',
                            fontWeight: 'medium',
                            '&:hover': { textDecoration: 'underline' }
                          }}
                        >
                          {company.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => onSelectCompany(company.id)}
                          disabled={busy}
                          title={`Admin Panel for ${company.name}`}
                          color="primary"
                        >
                          <AdminPanelSettings />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleCompanyDialog(company)}
                          disabled={busy}
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
                          disabled={busy}
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
              disabled={busy}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCompanyDialog} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveCompany}
            variant="contained"
            disabled={busy || !companyName.trim()}
          >
            {saving ? <CircularProgress size={20} /> : (editingCompany ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

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
          <Button onClick={() => setDeleteCompanyDialog(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleDeleteCompany} color="error" variant="contained" disabled={busy}>
            {saving ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CompaniesTab;
