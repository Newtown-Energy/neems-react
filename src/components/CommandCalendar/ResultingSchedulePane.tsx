/**
 * Resulting Schedule pane.
 *
 * Shown inside [DayDetailsDialog] for the selected day. Lists each
 * applicable library item in specificity order — prevailing row at the
 * top, superseded rows below — and renders an audit timeline showing
 * who created or last edited each rule and library item along with the
 * timestamps.
 *
 * The pane is read-only; it just surfaces the provenance data so the
 * operator can answer "why is this day on this schedule" without
 * digging through the library page.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import {
  Event as EventIcon,
  Loop as LoopIcon,
  Star as StarIcon
} from '@mui/icons-material';
import type { EntityActivityWithUser, ScheduleLibraryItem } from '@newtown-energy/types';

import { getEntityActivity } from '../../utils/scheduleApi';
import { errorLog } from '../../utils/debug';
import type { ApplicableLibraryItem } from './DayDetailsDialog';

interface ResultingSchedulePaneProps {
  applicableLibraryItems: ApplicableLibraryItem[];
}

function specificityLabel(s: number): string {
  if (s === 2) return 'Specific date';
  if (s === 1) return 'Day-of-week';
  if (s === 0) return 'Default';
  return 'Unknown';
}

function specificityIcon(s: number): React.ReactNode {
  if (s === 2) return <EventIcon fontSize="small" color="success" />;
  if (s === 1) return <LoopIcon fontSize="small" color="secondary" />;
  if (s === 0) return <StarIcon fontSize="small" color="primary" />;
  return null;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function formatRowSummary(row: EntityActivityWithUser): string {
  const actor = row.user_email ?? (row.user_id !== null ? `user #${row.user_id}` : 'system');
  const verb = row.operation_type === 'create'
    ? 'Created'
    : row.operation_type === 'update'
      ? 'Updated'
      : row.operation_type === 'delete'
        ? 'Deleted'
        : row.operation_type;
  return `${verb} by ${actor}`;
}

interface ProvenanceProps {
  item: ScheduleLibraryItem;
}

const Provenance: React.FC<ProvenanceProps> = ({ item }) => {
  const [activity, setActivity] = useState<EntityActivityWithUser[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Refetch when the item id changes (different schedule) AND when the
  // parent passes a freshly-loaded item ref (commands just changed,
  // updated_at advanced, etc.). The parent's CommandCalendar passes a
  // new applicableLibraryItems array after every loadSelectedDate, so
  // `item` is reference-fresh whenever the schedule actually moved.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        // The library-item rows live in the `schedule_templates`
        // table at the DB layer — the API surface uses "library item"
        // but the audit log keys off the physical table name.
        const rows = await getEntityActivity('schedule_templates', item.id);
        if (!cancelled) setActivity(rows);
      } catch (err) {
        errorLog('ResultingSchedulePane: failed to load activity', err);
        if (!cancelled) setActivity([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [item]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
        <CircularProgress size={14} />
        <Typography variant="caption" color="text.secondary">Loading audit…</Typography>
      </Box>
    );
  }

  if (!activity || activity.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        No audit entries.
      </Typography>
    );
  }

  // Show the most recent two entries — typically create + most recent
  // edit. The full history can live in a dedicated panel later if the
  // demo needs it.
  const recent = activity.slice(-2).reverse();
  return (
    <List dense disablePadding>
      {recent.map(row => (
        <ListItem key={row.id} disableGutters sx={{ py: 0 }}>
          <ListItemText
            primary={formatRowSummary(row)}
            secondary={formatTimestamp(row.timestamp)}
            primaryTypographyProps={{ variant: 'caption' }}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
        </ListItem>
      ))}
    </List>
  );
};

const ResultingSchedulePane: React.FC<ResultingSchedulePaneProps> = ({
  applicableLibraryItems
}) => {
  const ordered = useMemo(() => {
    // Show winning first, then by specificity descending so the
    // hierarchy is obvious without needing to read the chip.
    const winner = applicableLibraryItems.find(e => e.isActive);
    const rest = applicableLibraryItems
      .filter(e => !e.isActive)
      .sort((a, b) => b.specificity - a.specificity);
    return winner ? [winner, ...rest] : rest;
  }, [applicableLibraryItems]);

  if (ordered.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" gutterBottom>Resulting schedule</Typography>
      <Stack spacing={1}>
        {ordered.map(entry => (
          <Paper
            key={entry.item.id}
            variant="outlined"
            sx={{
              p: 1.5,
              borderColor: entry.isActive ? 'success.main' : 'divider',
              bgcolor: entry.isActive ? 'rgba(76, 175, 80, 0.06)' : 'background.paper'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
              {specificityIcon(entry.specificity)}
              <Typography variant="body2" sx={{ fontWeight: entry.isActive ? 'bold' : 'normal' }}>
                {entry.item.name}
              </Typography>
              <Chip
                label={specificityLabel(entry.specificity)}
                size="small"
                color={entry.specificity === 2 ? 'success' : entry.specificity === 1 ? 'secondary' : 'primary'}
                variant="outlined"
              />
              {entry.isActive ? (
                <Chip label="Prevailing" size="small" color="success" />
              ) : (
                <Chip label="Superseded" size="small" />
              )}
            </Box>
            <Provenance item={entry.item} />
          </Paper>
        ))}
      </Stack>
    </Box>
  );
};

export default ResultingSchedulePane;
