import type { SiteDesign } from './types';
import { NEWTOWN } from './newtown';

export type { ProjectInfo, SiteDesign } from './types';

/** Every design this build knows, keyed by the backend's design id. */
export const DESIGNS: Readonly<Record<string, SiteDesign>> = {
  [NEWTOWN.id]: NEWTOWN,
};

/** The design with this id, or `undefined` if this build has none. */
export function designById(id: string): SiteDesign | undefined {
  return Object.prototype.hasOwnProperty.call(DESIGNS, id) ? DESIGNS[id] : undefined;
}
