import { pageConfig as alarmsConfig } from '../pages/AlarmsPage';
import { pageConfig as fdnyConfig } from '../pages/FDNYPage';
import { pageConfig as reportsConfig } from '../pages/ReportsPage';
import { pageConfig as schedulerConfig } from '../pages/SchedulerPage';
import { pageConfig as siteSettingsConfig } from '../pages/SiteSettingsPage';
import { pageConfig as sldConfig } from '../pages/SldPage';

export interface PageConfig {
  id: string;
  title: string;
  icon?: React.ComponentType;
  iconPath?: string;
}

export const pageRegistry: Record<string, PageConfig> = {
  [alarmsConfig.id]: alarmsConfig,
  [fdnyConfig.id]: fdnyConfig,
  [reportsConfig.id]: reportsConfig,
  [schedulerConfig.id]: schedulerConfig,
  [siteSettingsConfig.id]: siteSettingsConfig,
  [sldConfig.id]: sldConfig,
};

export const getPageConfig = (pageId: string): PageConfig | undefined => {
  return pageRegistry[pageId];
};