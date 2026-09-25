// Unit tests run without the app shell, so nothing fetches the site design.
// Select Newtown up front — the tests pin Newtown's diagram and alarm numbers —
// exactly as [SiteDesignProvider] would for a Newtown deployment. Preloaded by
// bunfig.toml for every `bun test` run.

import { setActiveDesign } from './active';
import { NEWTOWN } from './newtown';

setActiveDesign(NEWTOWN);
