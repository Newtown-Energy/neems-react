import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button } from '@mui/material';
import { fetchSiteDesign } from '../utils/siteDesignApi';
import { errorLog } from '../utils/debug';
import { setActiveDesign } from './active';
import { SiteDesignContext } from './context';
import { describeFetchFailure, resolveDesign, retryDelayMs } from './resolveDesign';
import type { SiteDesign } from './types';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; design: SiteDesign }
  | { status: 'error'; message: string; retrying: boolean };

/**
 * Chooses the site design this session runs, from the backend's
 * `/api/1/SiteDesign`, and renders its children only once it has one.
 *
 * Nothing below can draw without a design, so there is no partial render: while
 * the request is out this shows the app's usual loading placeholder, and if it
 * fails it shows why, instead of drawing some other site's diagram.
 *
 * A failed request is retried on its own, with backoff, and can be retried by
 * hand. Everything past login waits on this one request, and an unattended
 * display that reloads during a backend restart must come back when the
 * backend does rather than sit on an error until someone clicks. A design the
 * frontend does not know, or disagrees with, is not retried: fetching again
 * returns the same answer, and only deploying matching versions fixes it.
 *
 * The design is also set for non-React code ([activeDesign]) before any child
 * renders, so the reducer and helpers read the same one the components do.
 */
export const SiteDesignProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const attempt = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Which request is the latest. A slower one — an automatic retry overtaken
  // by a click on Retry, or one still out when the provider unmounts at logout
  // — must not land after it and overwrite its answer.
  const generation = useRef(0);

  const load = useCallback(async () => {
    clearTimeout(retryTimer.current);
    generation.current += 1;
    const mine = generation.current;
    setState({ status: 'loading' });
    let dto;
    try {
      dto = await fetchSiteDesign();
    } catch (err) {
      if (mine !== generation.current) return;
      errorLog('Failed to load the site design', err);
      const delay = retryDelayMs(attempt.current);
      attempt.current += 1;
      retryTimer.current = setTimeout(() => { void load(); }, delay);
      setState({ status: 'error', message: describeFetchFailure(err), retrying: true });
      return;
    }
    if (mine !== generation.current) return;
    attempt.current = 0;
    const resolution = resolveDesign(dto);
    if (resolution.design) {
      setActiveDesign(resolution.design);
      setState({ status: 'ready', design: resolution.design });
    } else {
      setState({ status: 'error', message: resolution.error, retrying: false });
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      clearTimeout(retryTimer.current);
      // Retire any request still out, so it cannot land after unmount.
      generation.current += 1;
    };
  }, [load]);

  if (state.status === 'loading') return <div>Loading...</div>;
  if (state.status === 'error') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => { void load(); }}>
              Retry
            </Button>
          }
        >
          {state.message}
          {state.retrying && ' Retrying automatically.'}
        </Alert>
      </Box>
    );
  }
  return <SiteDesignContext.Provider value={state.design}>{children}</SiteDesignContext.Provider>;
};
