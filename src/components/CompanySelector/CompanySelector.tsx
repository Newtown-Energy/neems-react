import React, { useState, useEffect } from 'react';
import {
  FormControl,
  Select,
  MenuItem,
  Typography,
  Box,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { Business } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiRequestWithMapping } from '../../utils/api';
import type { Company } from '../../types/generated/Company';

interface CompanySelectorProps {
  collapsed: boolean;
  userRoles: string[];
  userCompanyName?: string;
}

export const CompanySelector: React.FC<CompanySelectorProps> = ({
  collapsed,
  userRoles,
  userCompanyName
}) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isSuperAdmin = userRoles.includes('newtown-admin') || userRoles.includes('newtown-staff');

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const companyParam = params.get('company');
    
    if (companyParam && companies.length > 0) {
      const companyId = parseInt(companyParam);
      setSelectedCompanyId(companyId);
    } else if (companies.length > 0 && selectedCompanyId === 0) {
      // Default to user's company if available, otherwise Newtown Energy
      if (userCompanyName) {
        const userCompany = companies.find(comp => comp.name === userCompanyName);
        if (userCompany) {
          setSelectedCompanyId(userCompany.id);
          return;
        }
      }
      // Default to Newtown Energy
      const newtownEnergy = companies.find(comp => comp.name === 'Newtown Energy');
      if (newtownEnergy) {
        setSelectedCompanyId(newtownEnergy.id);
      } else if (companies.length > 0) {
        // Fallback to first company if Newtown Energy doesn't exist
        setSelectedCompanyId(companies[0].id);
      }
    }
  }, [location.search, companies, userCompanyName, selectedCompanyId]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const data = await apiRequestWithMapping<Company[]>('/api/1/Companies');
      setCompanies(data);
    } catch (err) {
      console.error('Error fetching companies:', err);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyChange = (event: SelectChangeEvent<number>) => {
    const newCompanyId = Number(event.target.value);
    setSelectedCompanyId(newCompanyId);
    
    const params = new URLSearchParams(location.search);
    params.set('company', newCompanyId.toString());
    
    if (location.pathname === '/admin') {
      navigate(`/admin?${params.toString()}`);
    } else {
      navigate(`/admin?${params.toString()}`);
    }
  };

  if (!isSuperAdmin) {
    return null;
  }

  if (collapsed) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          p: 1,
          cursor: 'pointer'
        }}
        onClick={() => {
          if (selectedCompanyId > 0) {
            navigate(`/admin?company=${selectedCompanyId}`);
          } else {
            navigate('/admin');
          }
        }}
        title="Company Selection"
      >
        <Business sx={{ color: 'text.secondary' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, pt: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
        COMPANY
      </Typography>
      <FormControl fullWidth size="small">
        <Select
          id="company-selector-sidebar"
          value={selectedCompanyId || ''}
          onChange={handleCompanyChange}
          disabled={loading}
          sx={{
            fontSize: '0.875rem',
            '& .MuiSelect-select': {
              py: 1
            }
          }}
        >
          {companies.map((company) => (
            <MenuItem key={company.id} value={company.id}>
              {company.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};