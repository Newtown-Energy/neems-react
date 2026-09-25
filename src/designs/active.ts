import type { SiteDesign } from './types';

// The design this session runs, for code outside React — the diagram reducer,
// severity resolution, the demo drawer's helpers — that cannot use a hook.
// [SiteDesignProvider] sets it before rendering anything that could read it,
// and it does not change for the life of the page: the backend runs one design
// per deployment.

let active: SiteDesign | null = null;

/** Fix the session's design. Called by [SiteDesignProvider], and by tests. */
export function setActiveDesign(design: SiteDesign): void {
  active = design;
}

/**
 * The session's design.
 *
 * Throws if none has been selected yet: guessing one would draw another site's
 * diagram without anyone noticing, where an error says what went wrong.
 */
export function activeDesign(): SiteDesign {
  if (!active) {
    throw new Error('No site design selected yet; render inside <SiteDesignProvider>');
  }
  return active;
}
