/**
 * Schedule Audit Page.
 *
 * Full activity history for a single library item (schedule). Reached
 * from the "Show all" link in the Resulting Schedule pane's per-row
 * provenance summary. Renders every entity_activity row for the
 * underlying `schedule_templates` table entry in reverse chronological
 * order so the latest edit is at the top.
 *
 * Path: `/library/:itemId/audit`. Authenticated users can read this
 * surface — the gating mirrors the GET /EntityActivity endpoint.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import type { EntityActivityWithUser, ScheduleLibraryItem } from '@newtown-energy/types';

import { getLibraryItem, getEntityActivity } from '../utils/scheduleApi';
import { errorLog } from '../utils/debug';

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function operationChipColor(op: string): 'default' | 'success' | 'info' | 'warning' {
  if (op === 'create') return 'success';
  if (op === 'update') return 'info';
  if (op === 'delete') return 'warning';
  return 'default';
}

const ScheduleAuditPage: React.FC = () => {
  const { itemId: rawId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const itemId = rawId ? Number.parseInt(rawId, 10) : NaN;

  const [item, setItem] = useState<ScheduleLibraryItem | null>(null);
  const [activity, setActivity] = useState<EntityActivityWithUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(itemId)) {
      setError('Invalid schedule id in URL.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [fetchedItem, rows] = await Promise.all([
          getLibraryItem(itemId),
          getEntityActivity('schedule_templates', itemId)
        ]);
        if (!cancelled) {
          setItem(fetchedItem);
          setActivity(rows);
        }
      } catch (err) {
        errorLog('ScheduleAuditPage: failed to load', err);
        if (!cancelled) setError('Failed to load change history.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [itemId]);

  // Newest first — the table reads top-down, and the most recent event
  // is what an operator usually wants to see immediately.
  const ordered = activity ? [...activity].reverse() : [];

  return (
    <Box sx={{ p: 3, overflow: 'auto', flex: 1, minWidth: 0 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
        >
          Back
        </Button>
        <Box>
          <Typography variant="h4" component="h1">
            Schedule change history
          </Typography>
          {item && (
            <Typography variant="body2" color="text.secondary">
              {item.name}
            </Typography>
          )}
        </Box>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && !error && activity && activity.length === 0 && (
        <Alert severity="info">No change history recorded for this schedule.</Alert>
      )}

      {!loading && !error && ordered.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Operation</TableCell>
                <TableCell>When</TableCell>
                <TableCell>Actor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ordered.map(row => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Chip
                      label={row.operation_type}
                      size="small"
                      color={operationChipColor(row.operation_type)}
                    />
                  </TableCell>
                  <TableCell>{formatTimestamp(row.timestamp)}</TableCell>
                  <TableCell>
                    {row.user_email ??
                      (row.user_id !== null ? `user #${row.user_id}` : 'system')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default ScheduleAuditPage;
