import type { InjectHistoryRequest, InjectHistoryResponse } from '@newtown-energy/types';
import { apiRequestWithMapping } from './api';

/**
 * Ask the backend to generate simulated SoC + alarm history for a site.
 *
 * The frontend does NOT write the data itself — this triggers a server-side
 * backfill (the same generators as the `neems-data seed-*-history` CLI), so a
 * hardware-free demo gets several days of realistic-looking readings. Idempotent:
 * re-running only fills slots that aren't already present.
 *
 * Admin / newtown-admin / newtown-staff only.
 */
export async function injectDemoHistory(
  siteId: number,
  days: number,
): Promise<InjectHistoryResponse> {
  const body: InjectHistoryRequest = { site_id: siteId, days };
  return await apiRequestWithMapping<InjectHistoryResponse>('/api/1/Demo/InjectHistory', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
