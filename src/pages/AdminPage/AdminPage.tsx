import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Tab,
  Tabs,
  Typography
} from '@mui/material';
import { Business, LocationOn, Person, Refresh } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import type { CompanyWithTimestamps } from '@newtown-energy/types';
import { useAuth } from '../LoginPage/useAuth';
import { ApiError, apiRequestWithMapping } from '../../utils/api';
import type { ODataQueryOptions } from '../../utils/api';
import { isAdmin, isSuperAdmin } from '../../utils/auth';
import { debugLog, errorLog } from '../../utils/debug';
import UsersTab from './UsersTab';
import SitesTab from './SitesTab';
import CompaniesTab from './CompaniesTab';

const AdminPage: React.FC = () => {
  const { userInfo } = useAuth();
  const [searchParams] = useSearchParams();
  const [tabValue, setTabValue] = useState(0);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(0);
  const [companies, setCompanies] = useState<CompanyWithTimestamps[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userIsAdmin = isAdmin(userInfo?.roles);
  const userIsSuperAdmin = isSuperAdmin(userInfo?.roles);

  useEffect(() => {
    if (userIsAdmin) {
      fetchCompanies();
    }
  }, [userIsAdmin]);

  useEffect(() => {
    const companyParam = searchParams.get('company');
    if (companyParam && companies.length > 0) {
      setSelectedCompanyId(parseInt(companyParam));
    } else if (companies.length > 0 && selectedCompanyId === 0) {
      if (userInfo && userInfo.company_name) {
        const userCompany = companies.find(comp => comp.name === userInfo.company_name);
        if (userCompany) {
          setSelectedCompanyId(userCompany.id);
        } else {
          setSelectedCompanyId(companies[0].id);
        }
      } else {
        setSelectedCompanyId(companies[0].id);
      }
    }
  }, [searchParams, companies, userInfo, selectedCompanyId]);

  const fetchCompanies = async () => {
    debugLog('AdminPage: Fetching companies');
    setLoadingCompanies(true);
    try {
      const queryOptions: ODataQueryOptions = {
        $orderby: 'name',
        $count: true
      };
      const data = await apiRequestWithMapping<CompanyWithTimestamps[]>('/api/1/Companies', {}, queryOptions);
      setCompanies(data);
    } catch (err) {
      errorLog('Error fetching companies:', err);
      if (err instanceof ApiError) {
        setError(`Failed to load companies: ${err.message}`);
      }
      setCompanies([]);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleSelectCompanyFromList = (companyId: number) => {
    setSelectedCompanyId(companyId);
    setTabValue(0);
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('company', companyId.toString());
    window.history.replaceState(null, '', `?${newSearchParams.toString()}`);
  };

  if (!userIsAdmin) {
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
          onClick={fetchCompanies}
          disabled={loadingCompanies}
        >
          Refresh Data
        </Button>
      </Box>

      {error && (
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
              {userIsSuperAdmin && <Tab icon={<Business />} label="COMPANIES" />}
            </Tabs>
          </Box>

          {tabValue === 0 && (
            <UsersTab
              selectedCompanyId={selectedCompanyId}
              selectedCompanyName={selectedCompanyName}
              companies={companies}
            />
          )}

          {tabValue === 1 && (
            <SitesTab
              selectedCompanyId={selectedCompanyId}
              selectedCompanyName={selectedCompanyName}
              companies={companies}
            />
          )}

          {tabValue === 2 && userIsSuperAdmin && (
            <CompaniesTab
              companies={companies}
              loading={loadingCompanies}
              onSelectCompany={handleSelectCompanyFromList}
              onCompaniesChanged={fetchCompanies}
              onRefreshCompanies={fetchCompanies}
            />
          )}
        </>
      )}
    </Box>
  );
};

export default AdminPage;
