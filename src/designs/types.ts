import type React from 'react';
import type { AlarmZoneDto } from '@newtown-energy/types';
import type { SldLayoutProps } from '../components/SingleLineDiagram/layoutProps';
import type { ReadbackSpec } from '../components/SingleLineDiagram/readbackPositions';
import type { SldComponentState, SldWireState } from '../components/SingleLineDiagram/types';
import type { SiteConfig } from '../config/siteConfig';
import type { AlarmCategory } from '../utils/alarmHelpers';

/** The identity block a site's layout draws on its diagram. */
export interface ProjectInfo {
  name: string;
  address: string;
  codDate: string;
  bessRating: string;
  utilityProjectCode: string;
  developerProjectNumber: string;
}

/**
 * Everything the frontend needs to know that differs from one site to the
 * next: how its single line diagram is drawn and how its alarms are presented.
 *
 * The backend runs one design per deployment (neems-core's
 * `NEEMS_SITE_DESIGN`) and reports its id at `/api/1/SiteDesign`; the matching
 * design here is chosen from that. The alarms themselves — numbers, names,
 * zones, SLD targets — come from the backend; this carries only what the UI
 * adds on top of them.
 */
export interface SiteDesign {
  /** Matches the backend's design id. */
  id: string;
  diagram: {
    /** The layout's coordinate space; the viewer keeps this aspect ratio. */
    width: number;
    height: number;
    /** Every element the diagram tracks state for, and the alarm tokens each answers to. */
    components: SldComponentState[];
    wires: SldWireState[];
    /** Where each control's position is read from. See [derivePosition]. */
    readbacks: Record<string, ReadbackSpec>;
    Layout: React.ComponentType<SldLayoutProps>;
  };
  alarms: {
    /** The alarm that reports the site's physical E-stop. */
    estopAlarmNum: number;
    /** Alarms a fire department is shown (the spreadsheet's "IsFire?"). */
    fireAlarmNums: readonly number[];
    /** How each zone is named to an operator. */
    zoneDisplayNames: Record<AlarmZoneDto, string>;
    /** The operator-facing bucket each zone belongs to. */
    zoneCategories: Record<AlarmZoneDto, AlarmCategory>;
  };
  config: SiteConfig;
}
