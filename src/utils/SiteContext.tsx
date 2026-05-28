/**
 * Site selection context.
 *
 * Pages that need a "current site" pull from this context instead of holding
 * their own state, so that switching the site in one place updates every
 * other page that's mounted. The selection persists in localStorage so it
 * survives reload.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Site } from '@newtown-energy/types';

import { apiRequestWithMapping, ApiError } from './api';
import { debugLog, errorLog } from './debug';

const STORAGE_KEY = 'neems.selectedSiteId';

interface SiteContextValue {
  sites: Site[];
  selectedSiteId: number | null;
  selectedSite: Site | null;
  setSelectedSiteId: (id: number) => void;
  refresh: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const SiteContext = createContext<SiteContextValue | undefined>(undefined);

function readStoredId(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const id = Number.parseInt(raw, 10);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

export const SiteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteIdState] = useState<number | null>(readStoredId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setSelectedSiteId = useCallback((id: number) => {
    setSelectedSiteIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, String(id));
    } catch (e) {
      // localStorage can be disabled (Safari private mode, etc.) — fail soft.
      errorLog('SiteContext: failed to persist selectedSiteId', e);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequestWithMapping<Site[]>('/api/1/Sites');
      debugLog('SiteContext: loaded sites', { count: data.length });
      setSites(data);
      setSelectedSiteIdState(prev => {
        if (prev && data.some(s => s.id === prev)) return prev;
        return data[0]?.id ?? null;
      });
    } catch (err) {
      errorLog('SiteContext: failed to load sites', err);
      if (err instanceof ApiError) {
        setError(`Failed to load sites: ${err.message}`);
      } else {
        setError('Failed to load sites');
      }
      setSites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedSite = sites.find(s => s.id === selectedSiteId) ?? null;

  return (
    <SiteContext.Provider
      value={{ sites, selectedSiteId, selectedSite, setSelectedSiteId, refresh, loading, error }}
    >
      {children}
    </SiteContext.Provider>
  );
};

/**
 * Read the current site selection. Throws if used outside a [SiteProvider]
 * so missing wiring fails loudly instead of silently rendering with a null
 * site.
 */
export function useSiteContext(): SiteContextValue {
  const ctx = useContext(SiteContext);
  if (!ctx) {
    throw new Error('useSiteContext must be used inside a <SiteProvider>');
  }
  return ctx;
}
