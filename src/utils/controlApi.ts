import type { ControlRequestDto, SiteControlDto } from '@newtown-energy/types';
import { apiRequestWithMapping } from './api';

/**
 * Read a site's controls — the interactable elements of the diagram — each
 * with the most recent request made against it.
 *
 * The list is served rather than hardcoded here so the diagram cannot offer a
 * click the backend has no control for, or an action it would refuse.
 */
export async function fetchSiteControls(siteId: number): Promise<SiteControlDto[]> {
  return await apiRequestWithMapping<SiteControlDto[]>(`/api/1/Sites/${siteId}/Controls`);
}

/**
 * Ask a control to do something.
 *
 * The returned request is an ask that has been recorded, never a position. It
 * may come back `pending` (on its way), `sent` (it reached the RTAC), or
 * `failed` (it did not, and `failure_reason` says why). Where the equipment
 * actually ends up is reported separately by its readback point, and neither
 * answer stands in for the other.
 */
export async function requestControlAction(
  siteId: number,
  controlId: string,
  action: string,
): Promise<ControlRequestDto> {
  return await apiRequestWithMapping<ControlRequestDto>(
    `/api/1/Sites/${siteId}/Controls/${controlId}/Requests`,
    { method: 'POST', body: JSON.stringify({ action }) },
  );
}
