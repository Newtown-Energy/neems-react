import type { LatestAnalogsResponse } from '@newtown-energy/types';

import { apiRequestWithMapping } from './api';

/**
 * Fetch the most recent per-zone analog measurements for a site.
 *
 * Not a time series — this answers "what is true now". `fetchSocHistory` is
 * the one to reach for when you want a window.
 */
export async function fetchLatestAnalogs(siteId: number): Promise<LatestAnalogsResponse> {
  return await apiRequestWithMapping<LatestAnalogsResponse>(
    `/api/1/Sites/${siteId}/LatestAnalogs`,
  );
}
