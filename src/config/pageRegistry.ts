import { pageConfig as overviewConfig } from '../pages/OverviewPage';
import { pageConfig as alarmsConfig } from '../pages/AlarmsPage';
import { pageConfig as battery1Config } from '../pages/Battery1Page';
import { pageConfig as battery2Config } from '../pages/Battery2Page';
import { pageConfig as battery3Config } from '../pages/Battery3Page';
import { pageConfig as conedisonConfig } from '../pages/ConEdisonPage';
import { pageConfig as fdnyConfig } from '../pages/FDNYPage';
import { pageConfig as schedulerConfig } from '../pages/SchedulerPage';
import { pageConfig as sldConfig } from '../pages/SldPage';

export interface PageConfig {
  id: string;
  title: string;
  icon?: React.ComponentType;
  iconPath?: string;
}

export const pageRegistry: Record<string, PageConfig> = {
  [overviewConfig.id]: overviewConfig,
  [alarmsConfig.id]: alarmsConfig,
  [battery1Config.id]: battery1Config,
  [battery2Config.id]: battery2Config,
  [battery3Config.id]: battery3Config,
  [conedisonConfig.id]: conedisonConfig,
  [fdnyConfig.id]: fdnyConfig,
  [schedulerConfig.id]: schedulerConfig,
  [sldConfig.id]: sldConfig,
};

export const getPageConfig = (pageId: string): PageConfig | undefined => {
  return pageRegistry[pageId];
};