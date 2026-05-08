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
  IconButton,
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
import type { CompanyWithTimestamps, CreateSiteRequest, Site } from '@newtown-energy/types';
import { ApiError, apiRequestWithMapping } from '../../utils/api';
import { debugLog, errorLog } from '../../utils/debug';

interface SitesTabProps {
  selectedCompanyId: number;
  selectedCompanyName: string;
  companies: CompanyWithTimestamps[];
}

const SitesTab: React.FC<SitesTabProps> = ({ selectedCompanyId, selectedCompanyName, companies }) => {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [siteDialog, setSiteDialog] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [siteName, setSiteName] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [siteCompany, setSiteCompany] = useState<number>(0);
  const [deleteSiteDialog, setDeleteSiteDialog] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<Site | null>(null);
  const [siteModalError, setSiteModalError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCompanyId > 0) {
      fetchSites();
    } else {
      setSites([]);
    }
  }, [selectedCompanyId]);

  const fetchSites = async () => {
    if (!selectedCompanyId) {
      setSites([]);
      return;
    }

    debugLog('SitesTab: Fetching sites', { companyId: selectedCompanyId });
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequestWithMapping<Site[]>(`/api/1/Companies/${selectedCompanyId}/Sites`);
      const transformedSites = data.map((site) => ({
        ...site,
        location: site.address || `${site.latitude}, ${site.longitude}`,
        company_name: companies.find(c => c.id === site.company_id)?.name || 'Unknown',
        status: 'Active'
      }));
      setSites(transformedSites);
    } catch (err) {
      errorLog('Error fetching sites:', err);
      setError(err instanceof ApiError ? `Failed to load sites: ${err.message}` : 'Failed to load sites for this company');
      setSites([]);
    } finally {
      setLoading(false);
    }
  };

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
      const url = editingSite ? `/api/1/Sites/${editingSite.id}` : '/api/1/Sites';
      const method = editingSite ? 'PUT' : 'POST';

      const requestBody: CreateSiteRequest = {
        name: siteName,
        address: siteLocation,
        latitude: 0,
        longitude: 0,
        company_id: siteCompany || selectedCompanyId,
        ramp_duration_seconds: 0
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
      errorLog('Error saving site:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSite = async () => {
    if (!siteToDelete) return;

    setLoading(true);
    try {
      await apiRequestWithMapping(`/api/1/Sites/${siteToDelete.id}`, { method: 'DELETE' });
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
      errorLog('Error deleting site:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && !siteDialog && !deleteSiteDialog && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Site Management</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" startIcon={<Refresh />} onClick={fetchSites} disabled={loading}>
                Load Sites
              </Button>
              <Button variant="contained" startIcon={<Add />} onClick={() => handleSiteDialog()} disabled={loading}>
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
                        <Chip label="Active" size="small" color="success" />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleSiteDialog(site)} disabled={loading}>
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
          <Button onClick={handleDeleteSite} color="error" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SitesTab;
