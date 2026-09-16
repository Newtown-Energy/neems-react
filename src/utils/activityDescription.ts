/**
 * Presenting audit rows to an operator: what order they go in, and how
 * each one is worded.
 *
 * Four surfaces render schedule change history — the per-day change
 * pane, the Resulting Schedule pane's provenance summary, the Reports
 * "Recent schedule changes" feed, and the per-schedule audit page — and
 * each used to map `operation_type` to a verb and stop there. "Removed
 * by superadmin@example.com" is true and useless: it never says whether
 * a charge command was dropped, a duration shortened, or a target SoC
 * moved. They did not even agree with each other; the same deletion read
 * "Removed" on three of them and "Deleted" on the fourth.
 *
 * `change_details` (neems-core#136) carries the structured before/after.
 * This module is the single place that decides how to word it, so a fix
 * to the phrasing lands on every surface at once.
 *
 * Rows written before that backend change — and any write no API
 * handler mediated — have no details at all, so every caller must still
 * render sensibly from `verb` alone. Such a row gets "Updated": the
 * honest limit of what is known about it.
 *
 * Wording is deliberately shared, so a surface's own historic label
 * loses to the common one where they disagreed. Two user-visible
 * changes fall out of that, both intended:
 *
 *   - a template delete reads "Removed" everywhere; the Resulting
 *     Schedule pane used to call it "Deleted";
 *   - a detail-less template update reads "Updated" rather than the
 *     "Edited commands" the other three asserted without evidence.
 */

import type {
  ChangeDetails,
  CommandChange,
  CommandSnapshot,
  FieldChange
} from '@newtown-energy/types';

import {
  formatDaysOfWeek,
  formatDuration,
  getCommandTypeLabel,
  secondsToTime
} from './scheduleHelpers';

/** The parts of an activity row this module needs. Structural so it
 *  accepts both `EntityActivityWithUser` and the Reports feed's
 *  `RecentScheduleActivityEntry`. */
export interface ActivityRowLike {
  table_name: string;
  operation_type: string;
  change_details?: ChangeDetails | null;
}

/** The parts of an activity row needed to put rows in order. */
export interface OrderableActivityRow {
  id: number;
  timestamp: string;
}

/**
 * Newest first, with `id` breaking ties.
 *
 * The tie-break is not optional. Activity timestamps come from SQLite's
 * `CURRENT_TIMESTAMP` and resolve to the second, so a burst of edits
 * routinely shares one. Sorting on timestamp alone is stable, which
 * preserves the API's *ascending* order within a tie — so a surface
 * showing only the first row would show the oldest edit of that burst
 * as though it were the latest change.
 */
export function sortActivityNewestFirst<T extends OrderableActivityRow>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id - a.id);
}

export interface ActivityDescription {
  /** Short verb phrase for the headline, e.g. "Edited commands".
   *  Callers append their own context ("… Weeknight Discharge by
   *  alice@example.com"), so this never ends in a period. */
  verb: string;
  /** One sentence per thing that changed, newest-schedule-time first.
   *  Empty when the row recorded no details. */
  changes: string[];
}

/** A command's optional qualifiers as a parenthetical: "2h, to 80%". */
function qualifiers(command: CommandSnapshot): string {
  const parts: string[] = [];
  if (command.duration_seconds !== null) {
    parts.push(formatDuration(command.duration_seconds));
  }
  if (command.target_soc_percent !== null) {
    parts.push(`to ${command.target_soc_percent}%`);
  }
  return parts.join(', ');
}

/** "the 16:00 discharge" — the phrase every command sentence hangs off. */
function commandPhrase(command: CommandSnapshot): string {
  const time = secondsToTime(command.execution_offset_seconds);
  return `${time} ${getCommandTypeLabel(command.command_type).toLowerCase()}`;
}

function describeModification(change: CommandChange): string[] {
  const { command, previous } = change;
  if (!previous) {
    // Shouldn't happen — the backend always pairs `modified` with a
    // previous — but a half-written row shouldn't render as nothing.
    return [`Edited the ${commandPhrase(command)}`];
  }

  const sentences: string[] = [];
  const phrase = commandPhrase(previous);

  if (previous.command_type !== command.command_type) {
    sentences.push(
      `Changed the ${phrase} to a ${getCommandTypeLabel(command.command_type).toLowerCase()}`
    );
  }

  if (previous.duration_seconds !== command.duration_seconds) {
    if (previous.duration_seconds === null) {
      sentences.push(
        `Set the ${phrase} to run for ${formatDuration(command.duration_seconds)}`
      );
    } else if (command.duration_seconds === null) {
      sentences.push(`Cleared the duration on the ${phrase}`);
    } else {
      const verb = command.duration_seconds < previous.duration_seconds
        ? 'Shortened'
        : 'Lengthened';
      sentences.push(
        `${verb} the ${phrase} from ${formatDuration(previous.duration_seconds)}` +
          ` to ${formatDuration(command.duration_seconds)}`
      );
    }
  }

  if (previous.target_soc_percent !== command.target_soc_percent) {
    if (previous.target_soc_percent === null) {
      sentences.push(`Set the ${phrase} target to ${command.target_soc_percent}%`);
    } else if (command.target_soc_percent === null) {
      sentences.push(`Cleared the target on the ${phrase}`);
    } else {
      sentences.push(
        `Changed the ${phrase} target from ${previous.target_soc_percent}%` +
          ` to ${command.target_soc_percent}%`
      );
    }
  }

  return sentences.length > 0 ? sentences : [`Edited the ${phrase}`];
}

function describeCommandChange(change: CommandChange): string[] {
  const extra = qualifiers(change.command);
  const suffix = extra ? ` (${extra})` : '';

  switch (change.kind) {
    case 'added':
      return [`Added a ${commandPhrase(change.command)}${suffix}`];
    case 'removed':
      return [`Removed the ${commandPhrase(change.command)}${suffix}`];
    case 'modified':
      return describeModification(change);
  }
}

/** Parse the comma-joined day indices the backend records back to
 *  numbers, dropping anything that isn't one. */
function parseDayList(value: string): number[] {
  return value
    .split(',')
    .map(part => Number.parseInt(part.trim(), 10))
    .filter(day => Number.isInteger(day));
}

/** Dates listed in full before a rule's coverage is summarized. The
 *  peak scheduler writes rules spanning dozens of dates, and listing
 *  them all swamps every history they appear in (#166). */
const MAX_LISTED_DATES = 3;

/** Render the comma-joined ISO dates the backend records, collapsing
 *  a long list to its count and span. */
function summarizeDateList(value: string): string {
  const dates = value
    .split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .sort();
  if (dates.length <= MAX_LISTED_DATES) return dates.join(', ');
  return `${dates.length} dates, ${dates[0]} to ${dates[dates.length - 1]}`;
}

function describeFieldChange(field: FieldChange): string[] {
  // A rule's create row records values under `to`, its delete row under
  // `from`. Which one is populated is therefore also the tense.
  const value = field.to ?? field.from;
  const isRemoval = field.to === null || field.to === undefined;

  switch (field.field) {
    case 'name':
      if (field.from && field.to) return [`Renamed from "${field.from}" to "${field.to}"`];
      if (field.to) return [`Named "${field.to}"`];
      return [];

    case 'description':
      if (!field.to) return ['Cleared the description'];
      if (field.from) return ['Changed the description'];
      return ['Added a description'];

    case 'specific_dates': {
      if (!value) return [];
      const dates = summarizeDateList(value);
      return [isRemoval ? `Covered ${dates}` : `Covers ${dates}`];
    }

    case 'days_of_week': {
      if (!value) return [];
      const days = formatDaysOfWeek(parseDayList(value));
      if (!days) return [];
      return [isRemoval ? `Covered ${days}` : `Covers ${days}`];
    }

    case 'rule_type':
      // For dated and day-of-week rules the dates above already say the
      // scope, so this would only repeat it. A default rule has no
      // dates of its own, which makes this the only thing to say.
      if (value !== 'default') return [];
      return [isRemoval ? 'Was the site default' : 'Becomes the site default'];

    default:
      return [];
  }
}

function templateVerb(operation: string, details: ChangeDetails | null): string {
  if (operation === 'create') return 'Created';
  if (operation === 'delete') return 'Removed';
  if (operation !== 'update') return operation;

  const touchedCommands = details !== null && details.commands.length > 0;
  const fields = details?.fields ?? [];

  if (touchedCommands && fields.length > 0) return 'Edited';
  if (touchedCommands) return 'Edited commands';
  // "Renamed" only when the name is the *whole* story. A save that also
  // reworked the description was more than a rename, and saying
  // otherwise buries the rest of it.
  if (fields.length === 1 && fields[0].field === 'name') return 'Renamed';
  if (fields.length > 0) return 'Edited details';

  // Nothing recorded. "Updated" is all we actually know: three of these
  // surfaces used to label *every* template update "Edited commands",
  // which is a guess that a rename-only row gets flatly wrong. Stating
  // something confidently that the data doesn't support is the failure
  // this whole change exists to fix, so don't reintroduce it in the
  // fallback.
  return 'Updated';
}

/** The rule's type, as recorded on the row. A create carries it under
 *  `to`, a delete under `from`; either way it says what kind of rule
 *  this was. Null on rows written before the backend recorded it. */
function ruleTypeOf(details: ChangeDetails | null): string | null {
  const field = details?.fields.find(f => f.field === 'rule_type');
  return field ? field.to ?? field.from ?? null : null;
}

function ruleVerb(operation: string, details: ChangeDetails | null): string {
  if (operation === 'create') return 'Applied';
  if (operation === 'update') return 'Updated';
  if (operation !== 'delete') return operation;

  // A bare "Removed" left operators asking what was removed, and missed
  // the consequence: with the rule gone, the day falls back to whatever
  // is underneath it — usually the site default. Naming the kind of rule
  // makes that readable.
  //
  // Not every rule is an override: "override" is what this product calls
  // a specific-date rule (see the day modal's "Specific date override"
  // chip), and calling a default or day-of-week rule one would be wrong.
  switch (ruleTypeOf(details)) {
    case 'specific_date':
      return 'Removed override';
    case 'day_of_week':
      return 'Removed day-of-week rule';
    case 'default':
      return 'Removed default rule';
    default:
      // Pre-#136 rows recorded no type. "Removed rule" is vaguer than
      // the others but still says what went; guessing "override" would
      // be wrong a fraction of the time and unfalsifiable from here.
      return 'Removed rule';
  }
}

/**
 * Describe one activity row: a headline verb, plus a sentence for each
 * thing that actually changed.
 *
 * @example
 * describeActivity(row)
 * // { verb: 'Edited commands',
 * //   changes: ['Shortened the 16:00 discharge from 4h to 2h',
 * //             'Removed the 21:00 charge (1h, to 80%)'] }
 */
export function describeActivity(row: ActivityRowLike): ActivityDescription {
  const details = row.change_details ?? null;
  const isTemplate = row.table_name === 'schedule_templates';

  // On a rule delete the verb already names the rule's type, so the
  // `rule_type` sentence would only repeat it.
  const isRuleDelete = !isTemplate && row.operation_type === 'delete';
  const fields = isRuleDelete
    ? (details?.fields ?? []).filter(f => f.field !== 'rule_type')
    : details?.fields ?? [];

  const changes = details
    ? [...fields.flatMap(describeFieldChange), ...details.commands.flatMap(describeCommandChange)]
    : [];

  return {
    verb: isTemplate
      ? templateVerb(row.operation_type, details)
      : ruleVerb(row.operation_type, details),
    changes
  };
}

/**
 * The actor to credit for a row. Every surface needs this and every
 * surface had its own copy.
 */
export function describeActor(row: {
  user_email: string | null;
  user_id: number | null;
}): string {
  return row.user_email ?? (row.user_id !== null ? `user #${row.user_id}` : 'system');
}
