/**
 * Site API helpers — thin wrappers around the centralized API client.
 *
 * The schedule pages and the peak-season wizard write through these
 * helpers; keeping the endpoint URLs in one place makes it easy to point
 * the demo at a different backend or version path later.
 */

import type { Site, UpdateSiteRequest } from '@newtown-energy/types';

import { apiRequestWithMapping } from './api';

export async function fetchSites(): Promise<Site[]> {
  return await apiRequestWithMapping<Site[]>('/api/1/Sites');
}

export async function fetchSite(siteId: number): Promise<Site> {
  return await apiRequestWithMapping<Site>(`/api/1/Sites/${siteId}`);
}

/**
 * Partial update against PUT /api/1/Sites/<id>. All fields on the request
 * are optional; omitted fields are left untouched server-side. Returns the
 * updated [Site] so callers can refresh local state without an extra GET.
 */
export async function updateSite(
  siteId: number,
  patch: UpdateSiteRequest
): Promise<Site> {
  return await apiRequestWithMapping<Site>(`/api/1/Sites/${siteId}`, {
    method: 'PUT',
    body: JSON.stringify(patch)
  });
}
