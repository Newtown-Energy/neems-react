// How Newtown's alarms are presented: which one is the E-stop, which a fire
// department is shown, and what each zone is called and grouped under. The
// alarms themselves come from the backend.

import type { AlarmZoneDto } from '@newtown-energy/types';
import type { AlarmCategory } from '../../utils/alarmHelpers';

/**
 * Alarm number the RTAC raises while the site's E-stop is tripped.
 *
 * Mirrors the Newtown design's `ESTOP_ALARM_NUM` in neems-data. The E-stop is
 * a button on site: nothing in this interface can press or clear it, and this
 * alarm is all the UI ever knows about it. It is never read as the outcome of
 * an emergency shutdown request.
 */
export const ESTOP_ALARM_NUM = 104;

// Which alarms a fire department is being shown.
//
// The client spreadsheet carries an "IsFire?" column, surfaced as `is_fire` in
// neems-core/docs/alarms/newtown-alarms.json. The API does not expose it yet,
// so the set lives here as a constant. The intended exit: once `is_fire` rides
// the spreadsheet -> spec -> DTO -> generated-types pipeline, delete this list
// and read the flag off AlarmDefinitionDto.
//
// Regenerate the list from a newer spec with:
//
//   python3 -c "import json; \
//     print([a['alarm_num'] for a in \
//       json.load(open('newtown-alarms.json'))['digital_alarms'] if a['is_fire']])"
//
// Note that zone is NOT a stand-in for this. `getZoneCategory(zone) === 'Fire'`
// is the fire-panel zone alone; the spreadsheet also marks the thermal and
// sparker alarms on each Megapack, which is the pack telling you it is on its
// way to a fire.

/** Alarm numbers the spreadsheet marks `IsFire?` = Y. */
export const FIRE_ALARM_NUMS: readonly number[] = [
  // Fire alarm panel (Facp)
  401, // fire_alarm
  402, // facp_trouble
  403, // facp_supervisory
  404, // flir_zone_1
  405, // flir_zone_2
  406, // flir_zone_3
  407, // flir_zone_4
  408, // flir_zone_5
  409, // flir_zone_6
  410, // flir_zone_7
  411, // flir_zone_8
  412, // flir_zone_9
  413, // flir_zone_10
  414, // suppression_zone_1
  415, // suppression_zone_2
  416, // suppression_zone_3
  417, // suppression_zone_4
  418, // suppression_zone_5
  419, // alarm_mp_1a
  420, // alarm_mp_1b
  421, // alarm_mp_1c
  422, // alarm_mp_2a
  423, // alarm_mp_2b
  424, // alarm_mp_2c

  // Megapack thermal + sparker, three per pack
  611, // MP-1A extreme_temp_warning
  612, // MP-1A extreme_temp_fault
  619, // MP-1A sparker
  641, // MP-1B extreme_temp_warning
  642, // MP-1B extreme_temp_fault
  649, // MP-1B sparker
  671, // MP-1C extreme_temp_warning
  672, // MP-1C extreme_temp_fault
  679, // MP-1C sparker
  701, // MP-2A extreme_temp_warning
  702, // MP-2A extreme_temp_fault
  709, // MP-2A sparker
  731, // MP-2B extreme_temp_warning
  732, // MP-2B extreme_temp_fault
  739, // MP-2B sparker
  761, // MP-2C extreme_temp_warning
  762, // MP-2C extreme_temp_fault
  769, // MP-2C sparker
];

/** How each zone is named to an operator. */
export const ZONE_DISPLAY_NAMES: Record<AlarmZoneDto, string> = {
  Site: 'Site',
  BreakerRelay: 'Breaker Relay (SEL-451)',
  Meter: 'Meter (SEL-735)',
  Transformer1: 'Transformer 1',
  Transformer2: 'Transformer 2',
  Rtac: 'RTAC',
  Facp: 'Fire Alarm Panel',
  TeslaSiteController: 'Tesla Site Controller',
  Mp1a: 'Megapack 1A',
  Mp1b: 'Megapack 1B',
  Mp1c: 'Megapack 1C',
  Mp2a: 'Megapack 2A',
  Mp2b: 'Megapack 2B',
  Mp2c: 'Megapack 2C',
};

/**
 * The operator-facing bucket each zone belongs to (electrical / fire / battery
 * / control), as the Alarms and FDNY pages group them.
 */
export const ZONE_CATEGORIES: Record<AlarmZoneDto, AlarmCategory> = {
  Facp: 'Fire',
  BreakerRelay: 'Electrical',
  Meter: 'Electrical',
  Transformer1: 'Electrical',
  Transformer2: 'Electrical',
  Mp1a: 'Battery',
  Mp1b: 'Battery',
  Mp1c: 'Battery',
  Mp2a: 'Battery',
  Mp2b: 'Battery',
  Mp2c: 'Battery',
  TeslaSiteController: 'Battery',
  Site: 'Control',
  Rtac: 'Control',
};
