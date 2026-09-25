import { createContext, useContext } from 'react';
import type { SiteDesign } from './types';

// Kept apart from [SiteDesignProvider] so that anything a design itself imports
// (its layout reads `useSiteConfig`) can reach the design without importing the
// provider, which imports the registry, which imports the designs.

export const SiteDesignContext = createContext<SiteDesign | null>(null);

/** The session's site design. Must be rendered inside [SiteDesignProvider]. */
export function useSiteDesign(): SiteDesign {
  const design = useContext(SiteDesignContext);
  if (!design) throw new Error('useSiteDesign must be used inside <SiteDesignProvider>');
  return design;
}
