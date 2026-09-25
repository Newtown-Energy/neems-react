import type { SiteConfig } from '../../config/siteConfig';

/** Newtown's per-site toggles. See [SiteConfig]. */
export const SITE_CONFIG: SiteConfig = {
  sld: {
    showLockoutRelay: true,
  },
  lockout: {
    remoteTriggerEnabled: false,
  },
  alarmLevelOverrides: {},
};
