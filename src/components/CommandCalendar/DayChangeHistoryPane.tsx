/**
 * Per-day change history.
 *
 * Demo feedback (2026-05-18): each day in the calendar should show
 * who applied this schedule and when, with the reason inline. The
 * existing `ResultingSchedulePane` already shows library-item
 * provenance (create/update of the schedule itself) but doesn't
 * surface the rule-level activity — which is where the override
 * reason lives.
 *
 * This pane fetches `EntityActivity` rows for the day's prevailing
 * `application_rules` row and renders a compact timeline. Renders
 * nothing when there's no rule (e.g. an unscheduled day).
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography
} from '@mui/material';
import type { EntityActivityWithUser } from '@newtown-energy/types';

import { getEntityActivity } from '../../utils/scheduleApi';
import { errorLog } from '../../utils/debug';

interface DayChangeHistoryPaneProps {
  ruleId: number | null;
  /** Surfaced inline so the operator sees the reason next to the
   *  "applied by" rows. May be null when the rule has no recorded
   *  reason (e.g. legacy default rule, day-of-week toggle). */
  overrideReason: string | null;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function formatRow(row: EntityActivityWithUser): string {
  const actor = row.user_email ?? (row.user_id !== null ? `user #${row.user_id}` : 'system');
  const verb = row.operation_type === 'create'
    ? 'Applied'
    : row.operation_type === 'update'
      ? 'Updated'
      : row.operation_type === 'delete'
        ? 'Removed'
        : row.operation_type;
  return `${verb} by ${actor}`;
}

const DayChangeHistoryPane: React.FC<DayChangeHistoryPaneProps> = ({
  ruleId,
  overrideReason
}) => {
  const [activity, setActivity] = useState<EntityActivityWithUser[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ruleId == null) {
      setActivity(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        // Rule rows live in `application_rules` at the DB layer — the
        // entity-activity API keys off the physical table name.
        const rows = await getEntityActivity('application_rules', ruleId);
        if (!cancelled) setActivity(rows);
      } catch (err) {
        errorLog('DayChangeHistoryPane: failed to load activity', err);
        if (!cancelled) setActivity([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ruleId]);

  // No rule = no history pane (e.g. a day with no schedule applied).
  if (ruleId == null) return null;

  // Show newest first so the most recent change is at eye level.
  const ordered = activity
    ? [...activity].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    : null;

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
          No recorded changes for this day's rule.
        </Typography>
      )}
      {!loading && ordered && ordered.length > 0 && (
        <List dense disablePadding>
          {ordered.map(row => (
            <ListItem key={row.id} disableGutters sx={{ py: 0.25 }}>
              <ListItemText
                primary={formatRow(row)}
                secondary={
                  <>
                    {formatTimestamp(row.timestamp)}
                    {overrideReason && row.operation_type === 'create' && (
                      <Box
                        component="span"
                        sx={{ display: 'block', mt: 0.25, fontStyle: 'italic' }}
                      >
                        Reason: {overrideReason}
                      </Box>
                    )}
                  </>
                }
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption', component: 'div' }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default DayChangeHistoryPane;
