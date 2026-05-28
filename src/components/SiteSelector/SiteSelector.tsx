import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  type SelectChangeEvent
} from '@mui/material';

import { useSiteContext } from '../../utils/SiteContext';

interface SiteSelectorProps {
  label?: string;
  disabled?: boolean;
  size?: 'small' | 'medium';
  /** Override the maxWidth applied to the dropdown — defaults to 320px. */
  maxWidth?: number;
}

/**
 * Site selector dropdown. Reads from the shared [SiteContext] so a
 * selection made on any page is reflected everywhere the selector is
 * rendered. The list of sites is whatever the current user can see.
 */
const SiteSelector: React.FC<SiteSelectorProps> = ({
  label = 'Site',
  disabled = false,
  size = 'small',
  maxWidth = 320
}) => {
  const { sites, selectedSiteId, setSelectedSiteId, loading, error } = useSiteContext();

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  const handleChange = (event: SelectChangeEvent<number>) => {
    const id = event.target.value as number;
    if (Number.isFinite(id)) {
      setSelectedSiteId(id);
    }
  };

  return (
    <FormControl size={size} sx={{ minWidth: 200, maxWidth }} disabled={disabled || loading}>
      <InputLabel id="site-selector-label">{label}</InputLabel>
      <Select
        labelId="site-selector-label"
        id="site-selector"
        value={selectedSiteId ?? ''}
        label={label}
        onChange={handleChange}
        endAdornment={loading ? <CircularProgress size={16} sx={{ mr: 3 }} /> : null}
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
