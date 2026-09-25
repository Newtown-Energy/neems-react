import type { EmergencyShutdownStatusResponse } from '@newtown-energy/types';
import { apiRequestWithMapping } from './api';

/**
 * Read a site's emergency shutdown status: what the RTAC reports about the
 * E-stop (alarm 104), plus any shutdown request.
 */
export async function fetchEmergencyShutdownStatus(
  siteId: number,
): Promise<EmergencyShutdownStatusResponse> {
  return await apiRequestWithMapping<EmergencyShutdownStatusResponse>(
    `/api/1/Sites/${siteId}/EmergencyShutdown`,
  );
}

/**
 * Request an emergency shutdown of a site.
 *
 * The site's E-stop is a physical button and cannot be pressed from here; this
 * asks the site to shut down. Engage-only: there is no counterpart to clear a
 * trip. A latched E-stop is cleared at the panel, after which alarm 104 drops
 * and the UI follows.
 *
 * The request resolves once the signal reaches the RTAC, which is all the
 * backend undertakes to do; whether the plant then stops is reported
 * separately by `observed_active`, and may never happen. A returned request is
 * an ask that has been recorded, not a state change.
 */
export async function requestEmergencyShutdown(
  siteId: number,
): Promise<EmergencyShutdownStatusResponse> {
  return await apiRequestWithMapping<EmergencyShutdownStatusResponse>(
    `/api/1/Sites/${siteId}/EmergencyShutdown`,
    { method: 'POST' },
  );
}
