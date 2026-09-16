/**
 * Change history for one entity, newest first.
 *
 * Demo feedback (2026-05-18): each day in the calendar should show
 * who applied this schedule and when, with the reason inline. The
 * existing `ResultingSchedulePane` already shows library-item
 * provenance (create/update of the schedule itself) but doesn't
 * surface the rule-level activity — which is where the override
 * reason lives.
 *
 * It used to fetch *both* streams and merge them, which meant the day
 * modal rendered the prevailing schedule's own edits twice: once under
 * `ResultingSchedulePane` and again here (#164). `source` now names the
 * single stream to list, so each caller asks for the one thing its
 * section is about:
 *
 *   - the day modal → the day's `application_rules` row: which schedule
 *     was applied to this day, when, by whom and why;
 *   - the Library card → that schedule's own `schedule_templates` edits.
 *
 * The day modal lists only the verb and reason for each row. The
 * rule's field-level changes would restate which days it covers, and
 * for a peak-scheduler rule that is dozens of dates (#166).
 *
 * Long histories collapse to the most recent entry with an in-place
 * expand. Unlike `ResultingSchedulePane`, which links to
 * `/library/:itemId/audit` for the rest, there is no per-rule audit
 * page to send anyone to.
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Link,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography
} from '@mui/material';
import {
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import type { EntityActivityWithUser } from '@newtown-energy/types';

import { getEntityActivity } from '../../utils/scheduleApi';
import {
  describeActivity,
  describeActor,
  sortActivityNewestFirst
} from '../../utils/activityDescription';
import { errorLog } from '../../utils/debug';

/** The one activity stream a pane lists. */
export interface ChangeHistorySource {
  table: 'application_rules' | 'schedule_templates';
  entityId: number;
}

interface DayChangeHistoryPaneProps {
  /** Whose history to list. Null renders nothing — an unscheduled day
   *  has no rule to report on. */
  source: ChangeHistorySource | null;
  /** Schedule to name and link in each row. Display only: it says
   *  *which* schedule a row is about, and is not what gets fetched. */
  libraryItem: { id: number; name: string } | null;
  /** Surfaced inline so the operator sees the reason next to the
   *  "applied by" rows. May be null when the rule has no recorded
   *  reason (e.g. legacy default rule, day-of-week toggle). */
  overrideReason: string | null;
}

/** Entries shown before the operator asks for the rest. */
const PREVIEW_COUNT = 1;

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

const DayChangeHistoryPane: React.FC<DayChangeHistoryPaneProps> = ({
  source,
  libraryItem,
  overrideReason
}) => {
  const [activity, setActivity] = useState<EntityActivityWithUser[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const sourceTable = source?.table ?? null;
  const sourceId = source?.entityId ?? null;

  useEffect(() => {
    if (sourceTable == null || sourceId == null) {
      setActivity(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    // Collapse again when the pane switches entities — the previous
    // day's expansion says nothing about this one.
    setExpanded(false);
    void (async () => {
      try {
        const rows = await getEntityActivity(sourceTable, sourceId);
        if (!cancelled) setActivity(rows);
      } catch (err) {
        errorLog('DayChangeHistoryPane: failed to load activity', err);
        if (!cancelled) setActivity([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sourceTable, sourceId]);

  if (sourceTable == null || sourceId == null) return null;

  // Newest first, so the most recent change is at eye level — and so
  // the one entry left after collapsing is the right one.
  const ordered = activity ? sortActivityNewestFirst(activity) : null;
  const visible = ordered && !expanded ? ordered.slice(0, PREVIEW_COUNT) : ordered;
  const hiddenCount = ordered ? ordered.length - PREVIEW_COUNT : 0;

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Change history
      </Typography>
      {loading && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.5 }}>
          <CircularProgress size={14} />
          <Typography variant="caption" color="text.secondary">
            Loading change history…
          </Typography>
        </Stack>
      )}
      {!loading && ordered && ordered.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          {sourceTable === 'application_rules'
            ? "No recorded changes for this day's rule."
            : 'No recorded changes for this schedule.'}
        </Typography>
      )}
      {!loading && visible && visible.length > 0 && (
        <List dense disablePadding>
          {visible.map(row => {
            // Prefer the per-row change_reason captured at API time
            // (S1b); fall back to the rule-level override_reason for
            // the rule's create row (S1's apply-different flow).
            const inlineReason = row.change_reason
              ?? ((row.operation_type === 'create' && row.table_name === 'application_rules')
                ? overrideReason
                : null);
            const { verb, changes: allChanges } = describeActivity(row);
            const changes = sourceTable === 'application_rules' ? [] : allChanges;
            const actor = describeActor(row);
            // A delete has nothing left to link to.
            const showScheduleLink = row.operation_type !== 'delete';
            return (
              <ListItem key={`${row.table_name}-${row.id}`} disableGutters sx={{ py: 0.25 }}>
                <ListItemText
                  primary={
                    <Typography variant="body2" component="span">
                      {verb}
                      {showScheduleLink && libraryItem && (
                        <>
                          {' '}
                          <Link
                            component={RouterLink}
                            to={`/library/${libraryItem.id}/audit`}
                            underline="hover"
                          >
                            {libraryItem.name}
                          </Link>
                        </>
                      )}
                      {' '}by {actor}
                    </Typography>
                  }
                  secondary={
                    <>
                      {formatTimestamp(row.timestamp)}
                      {changes.map(change => (
                        <Box key={change} component="span" sx={{ display: 'block', mt: 0.25 }}>
                          {change}
                        </Box>
                      ))}
                      {inlineReason && (
                        <Box
                          component="span"
                          sx={{ display: 'block', mt: 0.25, fontStyle: 'italic' }}
                        >
                          Reason: {inlineReason}
                        </Box>
                      )}
                    </>
                  }
                  secondaryTypographyProps={{ variant: 'caption', component: 'div' }}
                />
              </ListItem>
            );
          })}
        </List>
      )}
      {!loading && ordered && hiddenCount > 0 && (
        <Button
          size="small"
          onClick={() => setExpanded(prev => !prev)}
          startIcon={
            expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />
          }
          sx={{ textTransform: 'none', px: 0 }}
        >
          {expanded
            ? 'Show fewer'
            : `Show ${hiddenCount} earlier change${hiddenCount === 1 ? '' : 's'}`}
        </Button>
      )}
    </Box>
  );
};

export default DayChangeHistoryPane;
