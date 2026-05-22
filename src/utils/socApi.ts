import type { SocHistoryResponse } from '@newtown-energy/types';

import { apiRequest } from './api';

/**
 * Fetch SoC history for a site over the given window. Both `from` and
 * `to` are optional — omit them to let the backend return the full
 * available history.
 */
export async function fetchSocHistory(
  siteId: number,
  from?: Date,
  to?: Date,
): Promise<SocHistoryResponse> {
  const params = new URLSearchParams();
  if (from) params.set('from', from.toISOString().slice(0, 19) + 'Z');
  if (to) params.set('to', to.toISOString().slice(0, 19) + 'Z');
  const qs = params.toString();
  const url = `/api/1/Sites/${siteId}/SocHistory${qs ? `?${qs}` : ''}`;
  return await apiRequest<SocHistoryResponse>(url);
}
