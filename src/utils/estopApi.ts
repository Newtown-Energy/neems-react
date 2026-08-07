import type { EstopStatusResponse } from '@newtown-energy/types';
import { apiRequestWithMapping } from './api';

/**
 * Alarm number the RTAC raises when the site is in emergency stop.
 *
 * Mirrors `ESTOP_ALARM_NUM` in neems-data's `rtac::alarm_definitions`. This is
 * the only thing that decides whether the site is tripped — the UI never
 * authors that state.
 */
export const ESTOP_ALARM_NUM = 104;

/** Read a site's E-stop status: what the RTAC reports, plus any request. */
export async function fetchEstopStatus(siteId: number): Promise<EstopStatusResponse> {
  return await apiRequestWithMapping<EstopStatusResponse>(
    `/api/1/Sites/${siteId}/EmergencyStop`,
  );
}

/**
 * Request an emergency stop for a site.
 *
 * Engage-only: there is no counterpart to clear one. A latched E-stop is
 * cleared at the panel, after which alarm 104 drops and the UI follows.
 *
 * The request asks the *site* to trip. It resolves once the signal reaches the
 * RTAC, which is all the backend undertakes to do; whether the plant then stops
 * is reported separately by `observed_active`, and may never happen. A returned
 * request is an ask that has been recorded, not a state change.
 */
export async function requestEstop(siteId: number): Promise<EstopStatusResponse> {
  return await apiRequestWithMapping<EstopStatusResponse>(
    `/api/1/Sites/${siteId}/EmergencyStop`,
    { method: 'POST' },
  );
}
