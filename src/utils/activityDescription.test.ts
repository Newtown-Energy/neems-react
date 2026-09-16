/**
 * Unit tests for the shared activity-row phrasing helper.
 *
 * The point of this module is that one wording fix reaches every
 * history surface, so the tests pin the wording rather than the shape:
 * if a sentence changes here, it changed everywhere.
 *
 * Run with `bun test src/utils/activityDescription.test.ts` from the
 * `neems-react` directory (or `bun test` to run every test file).
 */

import { describe, expect, test } from 'bun:test';
import type { ChangeDetails, CommandSnapshot, CommandType } from '@newtown-energy/types';

import { describeActivity, describeActor } from './activityDescription';

function command(
  offset: number,
  type: CommandType,
  duration: number | null = null,
  soc: number | null = null
): CommandSnapshot {
  return {
    execution_offset_seconds: offset,
    command_type: type,
    duration_seconds: duration,
    target_soc_percent: soc
  };
}

function details(overrides: Partial<ChangeDetails> = {}): ChangeDetails {
  return { fields: [], commands: [], ...overrides };
}

describe('describeActivity — rows with no details', () => {
  test('says only what is known about a row that recorded nothing', () => {
    // Everything written before neems-core#136 looks like this.
    expect(describeActivity({ table_name: 'schedule_templates', operation_type: 'create' }))
      .toEqual({ verb: 'Created', changes: [] });
    expect(describeActivity({ table_name: 'application_rules', operation_type: 'create' }))
      .toEqual({ verb: 'Applied', changes: [] });
    expect(describeActivity({ table_name: 'application_rules', operation_type: 'delete' }))
      .toEqual({ verb: 'Removed', changes: [] });
  });

  test('a detail-less template update does not claim commands changed', () => {
    // Three surfaces used to label every template update "Edited
    // commands". For a row that recorded nothing that is a guess, and a
    // rename-only row makes it a wrong one.
    expect(describeActivity({ table_name: 'schedule_templates', operation_type: 'update' }))
      .toEqual({ verb: 'Updated', changes: [] });
  });

  test('a template delete reads the same as a rule delete', () => {
    // ResultingSchedulePane used to say "Deleted" here while every
    // other surface said "Removed". Converging them is the point.
    expect(describeActivity({ table_name: 'schedule_templates', operation_type: 'delete' }).verb)
      .toBe('Removed');
    expect(describeActivity({ table_name: 'application_rules', operation_type: 'delete' }).verb)
      .toBe('Removed');
  });

  test('passes an unrecognised operation through rather than inventing a verb', () => {
    const described = describeActivity({
      table_name: 'schedule_templates',
      operation_type: 'vacuum'
    });
    expect(described.verb).toBe('vacuum');
  });
});

describe('describeActivity — command changes', () => {
  test('names a removed command by its time and type', () => {
    const described = describeActivity({
      table_name: 'schedule_templates',
      operation_type: 'update',
      change_details: details({
        commands: [
          { kind: 'removed', command: command(75600, 'charge', 3600, 80), previous: null }
        ]
      })
    });
    expect(described.verb).toBe('Edited commands');
    expect(described.changes).toEqual(['Removed the 21:00 charge (1h, to 80%)']);
  });

  test('names an added command, and omits qualifiers it does not have', () => {
    const described = describeActivity({
      table_name: 'schedule_templates',
      operation_type: 'update',
      change_details: details({
        commands: [
          { kind: 'added', command: command(7200, 'trickle_charge'), previous: null }
        ]
      })
    });
    expect(described.changes).toEqual(['Added a 02:00 trickle charge']);
  });

  test('says how a duration moved, and in which direction', () => {
    const described = describeActivity({
      table_name: 'schedule_templates',
      operation_type: 'update',
      change_details: details({
        commands: [
          {
            kind: 'modified',
            command: command(57600, 'discharge', 7200),
            previous: command(57600, 'discharge', 14400)
          }
        ]
      })
    });
    expect(described.changes).toEqual(['Shortened the 16:00 discharge from 4h to 2h']);
  });

  test('reads a longer duration as lengthened', () => {
    const described = describeActivity({
      table_name: 'schedule_templates',
      operation_type: 'update',
      change_details: details({
        commands: [
          {
            kind: 'modified',
            command: command(57600, 'discharge', 14400),
            previous: command(57600, 'discharge', 7200)
          }
        ]
      })
    });
    expect(described.changes).toEqual(['Lengthened the 16:00 discharge from 2h to 4h']);
  });

  test('reports every field a single command changed', () => {
    const described = describeActivity({
      table_name: 'schedule_templates',
      operation_type: 'update',
      change_details: details({
        commands: [
          {
            kind: 'modified',
            command: command(79200, 'discharge', 3600, 90),
            previous: command(79200, 'charge', 3600, 80)
          }
        ]
      })
    });
    expect(described.changes).toEqual([
      'Changed the 22:00 charge to a discharge',
      'Changed the 22:00 charge target from 80% to 90%'
    ]);
  });

  test('handles a target or duration appearing and disappearing', () => {
    const appeared = describeActivity({
      table_name: 'schedule_templates',
      operation_type: 'update',
      change_details: details({
        commands: [
          {
            kind: 'modified',
            command: command(0, 'charge', 1800, 95),
            previous: command(0, 'charge', null, null)
          }
        ]
      })
    });
    expect(appeared.changes).toEqual([
      'Set the 00:00 charge to run for 30m',
      'Set the 00:00 charge target to 95%'
    ]);

    const cleared = describeActivity({
      table_name: 'schedule_templates',
      operation_type: 'update',
      change_details: details({
        commands: [
          {
            kind: 'modified',
            command: command(0, 'charge', null, null),
            previous: command(0, 'charge', 1800, 95)
          }
        ]
      })
    });
    expect(cleared.changes).toEqual([
      'Cleared the duration on the 00:00 charge',
      'Cleared the target on the 00:00 charge'
    ]);
  });

  test('describes a retimed command as a removal plus an addition', () => {
    // The backend matches commands on their time of day, so this is
    // what moving one looks like coming over the wire.
    const described = describeActivity({
      table_name: 'schedule_templates',
      operation_type: 'update',
      change_details: details({
        commands: [
          { kind: 'removed', command: command(57600, 'discharge', 7200), previous: null },
          { kind: 'added', command: command(61200, 'discharge', 7200), previous: null }
        ]
      })
    });
    expect(described.changes).toEqual([
      'Removed the 16:00 discharge (2h)',
      'Added a 17:00 discharge (2h)'
    ]);
  });
});

describe('describeActivity — field changes', () => {
  test('a rename reads as a rename', () => {
    const described = describeActivity({
      table_name: 'schedule_templates',
      operation_type: 'update',
      change_details: details({
        fields: [{ field: 'name', from: 'Weeknight', to: 'Weeknight Discharge' }]
      })
    });
    expect(described.verb).toBe('Renamed');
    expect(described.changes).toEqual(['Renamed from "Weeknight" to "Weeknight Discharge"']);
  });

  test('a rename alongside a description edit is more than a rename', () => {
    const described = describeActivity({
      table_name: 'schedule_templates',
      operation_type: 'update',
      change_details: details({
        fields: [
          { field: 'name', from: 'Weeknight', to: 'Weeknight Discharge' },
          { field: 'description', from: 'old', to: 'new' }
        ]
      })
    });
    // Calling this "Renamed" would bury the description edit listed
    // right under it.
    expect(described.verb).toBe('Edited details');
    expect(described.changes).toEqual([
      'Renamed from "Weeknight" to "Weeknight Discharge"',
      'Changed the description'
    ]);
  });

  test('a rename alongside command edits keeps the verb neutral', () => {
    const described = describeActivity({
      table_name: 'schedule_templates',
      operation_type: 'update',
      change_details: details({
        fields: [{ field: 'name', from: 'Weeknight', to: 'Weeknight Discharge' }],
        commands: [
          { kind: 'added', command: command(3600, 'charge'), previous: null }
        ]
      })
    });
    expect(described.verb).toBe('Edited');
    expect(described.changes).toHaveLength(2);
  });

  test('a created date override names the date it covers', () => {
    const described = describeActivity({
      table_name: 'application_rules',
      operation_type: 'create',
      change_details: details({
        fields: [
          { field: 'rule_type', from: null, to: 'specific_date' },
          { field: 'specific_dates', from: null, to: '2026-07-04' }
        ]
      })
    });
    expect(described.verb).toBe('Applied');
    // rule_type is dropped — the date already says the scope.
    expect(described.changes).toEqual(['Covers 2026-07-04']);
  });

  test('a removed date override still names the date, in the past tense', () => {
    const described = describeActivity({
      table_name: 'application_rules',
      operation_type: 'delete',
      change_details: details({
        fields: [
          { field: 'rule_type', from: 'specific_date', to: null },
          { field: 'specific_dates', from: '2026-07-04', to: null }
        ]
      })
    });
    expect(described.verb).toBe('Removed');
    expect(described.changes).toEqual(['Covered 2026-07-04']);
  });

  test('day-of-week rules render through the shared day formatter', () => {
    const described = describeActivity({
      table_name: 'application_rules',
      operation_type: 'create',
      change_details: details({
        fields: [
          { field: 'rule_type', from: null, to: 'day_of_week' },
          { field: 'days_of_week', from: null, to: '1,2,3,4,5' }
        ]
      })
    });
    expect(described.changes).toEqual(['Covers Monday-Friday']);
  });

  test('a default rule has no dates, so its type is the only thing to say', () => {
    const described = describeActivity({
      table_name: 'application_rules',
      operation_type: 'create',
      change_details: details({
        fields: [{ field: 'rule_type', from: null, to: 'default' }]
      })
    });
    expect(described.changes).toEqual(['Becomes the site default']);
  });
});

describe('describeActor', () => {
  test('prefers the email, falls back to the id, then to the system', () => {
    expect(describeActor({ user_email: 'alice@example.com', user_id: 7 }))
      .toBe('alice@example.com');
    expect(describeActor({ user_email: null, user_id: 7 })).toBe('user #7');
    expect(describeActor({ user_email: null, user_id: null })).toBe('system');
  });
});
