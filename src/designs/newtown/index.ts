import type { SiteDesign } from '../types';
import { SITE_CONFIG } from './config';
import { ESTOP_ALARM_NUM, FIRE_ALARM_NUMS, ZONE_CATEGORIES, ZONE_DISPLAY_NAMES } from './alarms';
import { COMPONENTS, HEIGHT, READBACKS, WIDTH, WIRES } from './diagram';
import NewtownLayout from './NewtownLayout';

/** The Newtown site design. */
export const NEWTOWN: SiteDesign = {
  id: 'newtown',
  diagram: {
    width: WIDTH,
    height: HEIGHT,
    components: COMPONENTS,
    wires: WIRES,
    readbacks: READBACKS,
    Layout: NewtownLayout,
  },
  alarms: {
    estopAlarmNum: ESTOP_ALARM_NUM,
    fireAlarmNums: FIRE_ALARM_NUMS,
    zoneDisplayNames: ZONE_DISPLAY_NAMES,
    zoneCategories: ZONE_CATEGORIES,
  },
  config: SITE_CONFIG,
};
