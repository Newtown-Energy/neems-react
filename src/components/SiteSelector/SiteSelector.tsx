import React from 'react';
import {
  FormControl,
  Select,
  MenuItem,
  Typography,
  Box,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { LocationOn } from '@mui/icons-material';

import { useSiteContext } from '../../utils/SiteContext';

interface SiteSelectorProps {
  collapsed: boolean;
}

/**
 * Sidebar site selector. Reads from [SiteContext] so a selection
 * change here is reflected on every page that uses `useSiteContext`.
 * With a single site available, the name is rendered as static text
 * instead of a dropdown.
 */
export const SiteSelector: React.FC<SiteSelectorProps> = ({ collapsed }) => {
  const { sites, selectedSiteId, setSelectedSiteId, loading } = useSiteContext();

  if (!loading && sites.length === 0) {
    return null;
  }

  if (collapsed) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 1 }} title="Current site">
        <LocationOn sx={{ color: 'text.secondary' }} />
      </Box>
    );
  }

  const handleChange = (event: SelectChangeEvent<number>) => {
    const id = Number(event.target.value);
    if (Number.isFinite(id)) {
      setSelectedSiteId(id);
    }
  };

  return (
    <Box sx={{ p: 2, pt: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
        SITE
      </Typography>
      {sites.length === 1 ? (
        <Typography variant="body2" sx={{ py: 1 }} noWrap>
          {sites[0].name}
        </Typography>
      ) : (
        <FormControl fullWidth size="small">
          <Select
            id="site-selector-sidebar"
            value={selectedSiteId ?? ''}
            onChange={handleChange}
            disabled={loading}
            sx={{
              fontSize: '0.875rem',
              '& .MuiSelect-select': {
                py: 1,
              },
            }}
          >
            {sites.map((site) => (
              <MenuItem key={site.id} value={site.id}>
                {site.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </Box>
  );
};

export default SiteSelector;
