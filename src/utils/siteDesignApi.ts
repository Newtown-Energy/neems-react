import type { SiteDesignDto } from '@newtown-energy/types';
import { apiRequestWithMapping } from './api';

/** The id of the site design this deployment's backend runs. No login needed. */
export async function fetchSiteDesign(): Promise<SiteDesignDto> {
  return await apiRequestWithMapping<SiteDesignDto>('/api/1/SiteDesign');
}
