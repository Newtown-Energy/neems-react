import React, { useState, useEffect } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  SelectChangeEvent
} from '@mui/material';
import { apiRequestWithMapping, ApiError } from '../../utils/api';
import type { Site } from '../../types/generated/Site';

interface SiteSelectorProps {
  selectedSiteId: number | null;
  onSiteChange: (siteId: number) => void;
  label?: string;
  disabled?: boolean;
}

/**
 * Site Selector Component
 *
 * Dropdown component for selecting a site. Fetches available sites
 * based on user permissions and displays them in a select input.
 */
const SiteSelector: React.FC<SiteSelectorProps> = ({
  selectedSiteId,
  onSiteChange,
  label = 'Select Site',
  disabled = false
}) => {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all sites the user has access to
      const data = await apiRequestWithMapping<Site[]>('/api/1/Sites');
      setSites(data);

      // Auto-select first site if none selected
      if (!selectedSiteId && data.length > 0) {
        onSiteChange(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching sites:', err);
      if (err instanceof ApiError) {
        setError(`Failed to load sites: ${err.message}`);
      } else {
        setError('Failed to load sites');
      }
      setSites([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (event: SelectChangeEvent<number>) => {
    const siteId = event.target.value as number;
    onSiteChange(siteId);
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <FormControl fullWidth disabled={disabled || loading}>
      <InputLabel id="site-selector-label">{label}</InputLabel>
      <Select
        labelId="site-selector-label"
        id="site-selector"
        value={selectedSiteId || ''}
        label={label}
        onChange={handleChange}
        endAdornment={loading ? <CircularProgress size={20} sx={{ mr: 2 }} /> : null}
      >
        {sites.length === 0 && !loading && (
          <MenuItem value="" disabled>
            No sites available
          </MenuItem>
        )}
        {sites.map((site) => (
          <MenuItem key={site.id} value={site.id}>
            {site.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default SiteSelector;
