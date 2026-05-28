import type {
  ChargeDischargeSummary,
  RecentScheduleActivityResponse,
} from '@newtown-energy/types';

import { apiRequest } from './api';

/**
 * Fetch per-day charge/discharge/hold minute totals for a site.
 * Backend defaults to the full available window when `from`/`to`
 * are omitted.
 */
export async function fetchChargeDischargeSummary(
  siteId: number,
  from?: Date,
  to?: Date,
): Promise<ChargeDischargeSummary> {
  const params = new URLSearchParams();
  if (from) params.set('from', from.toISOString().slice(0, 19) + 'Z');
  if (to) params.set('to', to.toISOString().slice(0, 19) + 'Z');
  const qs = params.toString();
  const url = `/api/1/Sites/${siteId}/ChargeDischargeSummary${qs ? `?${qs}` : ''}`;
  return await apiRequest<ChargeDischargeSummary>(url);
}

/**
 * Recent schedule activity (S1c-4) — merged feed across the site's
 * library items + application rules. Newest first; default limit 50.
 */
export async function fetchRecentScheduleActivity(
  siteId: number,
  limit = 50,
): Promise<RecentScheduleActivityResponse> {
  return await apiRequest<RecentScheduleActivityResponse>(
    `/api/1/Sites/${siteId}/RecentScheduleActivity?limit=${limit}`,
  );
}
