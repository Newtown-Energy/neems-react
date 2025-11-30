/**
 * Application Rule Dialog Component
 *
 * Unified dialog for managing application rules for a schedule library item.
 * Supports creating default, day-of-week, and specific date rules.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  FormGroup,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Star as StarIcon,
  Loop as LoopIcon,
  Event as EventIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import type { ScheduleLibraryItem, ApplicationRule } from '../../utils/mockScheduleApi';
import {
  getApplicationRules,
  createApplicationRule,
  deleteApplicationRule
} from '../../utils/mockScheduleApi';
import {
  getRuleTypeLabel,
  formatDaysOfWeek,
  toISODateString
} from '../../utils/scheduleHelpers';

interface ApplicationRuleDialogProps {
  open: boolean;
  libraryItem: ScheduleLibraryItem | null;
  onClose: () => void;
  onRulesChanged?: () => void;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ApplicationRuleDialog: React.FC<ApplicationRuleDialogProps> = ({
  open,
  libraryItem,
  onClose,
  onRulesChanged
}) => {
  const [rules, setRules] = useState<ApplicationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default rule state
  const [isDefault, setIsDefault] = useState(false);

  // Day of week rule state
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  // Specific date rule state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dateRangeStart, setDateRangeStart] = useState<Date | null>(null);
  const [dateRangeEnd, setDateRangeEnd] = useState<Date | null>(null);

  useEffect(() => {
    if (open && libraryItem) {
      loadRules();
    }
  }, [open, libraryItem]);

  const loadRules = async () => {
    if (!libraryItem) return;

    setLoading(true);
    setError(null);
    try {
      const fetchedRules = await getApplicationRules(libraryItem.id);
      setRules(fetchedRules);

      // Check if this item is currently default
      const defaultRule = fetchedRules.find(r => r.rule_type === 'default');
      setIsDefault(!!defaultRule);
    } catch (err) {
      setError('Failed to load rules');
      console.error('Error loading rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDefaultChange = async (checked: boolean) => {
    if (!libraryItem) return;

    setLoading(true);
    setError(null);
    try {
      if (checked) {
        // Create default rule (API will remove any existing default)
        await createApplicationRule({
          library_item_id: libraryItem.id,
          rule_type: 'default',
          days_of_week: null,
          specific_dates: null
        });
      } else {
        // Remove default rule
        const defaultRule = rules.find(r => r.rule_type === 'default');
        if (defaultRule) {
          await deleteApplicationRule(defaultRule.id);
        }
      }
      setIsDefault(checked);
      await loadRules();
      onRulesChanged?.();
    } catch (err) {
      setError('Failed to update default rule');
      console.error('Error updating default rule:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDayToggle = (dayIndex: number) => {
    setSelectedDays(prev =>
      prev.includes(dayIndex)
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex].sort((a, b) => a - b)
    );
  };

  const handleAddDayOfWeekRule = async () => {
    if (!libraryItem || selectedDays.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      await createApplicationRule({
        library_item_id: libraryItem.id,
        rule_type: 'day_of_week',
        days_of_week: selectedDays,
        specific_dates: null
      });
      setSelectedDays([]);
      await loadRules();
      onRulesChanged?.();
    } catch (err) {
      setError('Failed to create day-of-week rule');
      console.error('Error creating day-of-week rule:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSpecificDate = async () => {
    if (!libraryItem || !selectedDate) return;

    setLoading(true);
    setError(null);
    try {
      await createApplicationRule({
        library_item_id: libraryItem.id,
        rule_type: 'specific_date',
        days_of_week: null,
        specific_dates: [toISODateString(selectedDate)]
      });
      setSelectedDate(null);
      await loadRules();
      onRulesChanged?.();
    } catch (err) {
      setError('Failed to create specific date rule');
      console.error('Error creating specific date rule:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDateRange = async () => {
    if (!libraryItem || !dateRangeStart || !dateRangeEnd) return;

    if (dateRangeEnd < dateRangeStart) {
      setError('End date must be after start date');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Generate all dates in range
      const dates: string[] = [];
      const current = new Date(dateRangeStart);
      const end = new Date(dateRangeEnd);

      // eslint-disable-next-line no-unmodified-loop-condition -- Date objects are mutated in-place via setDate
      while (current <= end) {
        dates.push(toISODateString(current));
        current.setDate(current.getDate() + 1);
      }

      // Create one rule with all dates
      await createApplicationRule({
        library_item_id: libraryItem.id,
        rule_type: 'specific_date',
        days_of_week: null,
        specific_dates: dates
      });

      setDateRangeStart(null);
      setDateRangeEnd(null);
      await loadRules();
      onRulesChanged?.();
    } catch (err) {
      setError('Failed to create date range rule');
      console.error('Error creating date range rule:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    setLoading(true);
    setError(null);
    try {
      await deleteApplicationRule(ruleId);
      await loadRules();
      onRulesChanged?.();

      // Update isDefault state if we deleted the default rule
      const deletedRule = rules.find(r => r.id === ruleId);
      if (deletedRule?.rule_type === 'default') {
        setIsDefault(false);
      }
    } catch (err) {
      setError('Failed to delete rule');
      console.error('Error deleting rule:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatRuleDetails = (rule: ApplicationRule): string => {
    if (rule.rule_type === 'default') {
      return 'Applies to all unmatched dates';
    }
    if (rule.rule_type === 'day_of_week' && rule.days_of_week) {
      return formatDaysOfWeek(rule.days_of_week);
    }
    if (rule.rule_type === 'specific_date' && rule.specific_dates) {
      if (rule.specific_dates.length === 1) {
        return rule.specific_dates[0];
      }
      return `${rule.specific_dates.length} dates: ${rule.specific_dates[0]} to ${rule.specific_dates[rule.specific_dates.length - 1]}`;
    }
    return '';
  };

  const getRuleIcon = (ruleType: ApplicationRule['rule_type']) => {
    if (ruleType === 'default') return <StarIcon fontSize="small" />;
    if (ruleType === 'day_of_week') return <LoopIcon fontSize="small" />;
    return <EventIcon fontSize="small" />;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          Manage Rules: {libraryItem?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {/* Existing Rules */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Current Rules
              </Typography>
              {loading && rules.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : rules.length > 0 ? (
                <List>
                  {rules.map(rule => (
                    <ListItem key={rule.id} divider>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getRuleIcon(rule.rule_type)}
                            <Typography variant="body1">
                              {getRuleTypeLabel(rule.rule_type)}
                            </Typography>
                          </Box>
                        }
                        secondary={formatRuleDetails(rule)}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleDeleteRule(rule.id)}
                          color="error"
                          disabled={loading}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No rules defined yet. Add rules below to specify when this schedule is used.
                </Typography>
              )}
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Default Rule Section */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <StarIcon color="primary" />
                <Typography variant="h6">
                  Universal Default
                </Typography>
              </Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isDefault}
                    onChange={e => handleDefaultChange(e.target.checked)}
                    disabled={loading}
                  />
                }
                label="Use this schedule as the universal default for all unmatched dates"
              />
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Day of Week Rule Section */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <LoopIcon color="secondary" />
                <Typography variant="h6">
                  Day of Week Rules
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Select one or more days to create a recurring weekly rule:
              </Typography>
              <FormGroup row sx={{ mb: 2 }}>
                {DAY_NAMES.map((dayName, index) => (
                  <FormControlLabel
                    key={dayName}
                    control={
                      <Checkbox
                        checked={selectedDays.includes(index)}
                        onChange={() => handleDayToggle(index)}
                        disabled={loading}
                      />
                    }
                    label={dayName.substring(0, 3)}
                  />
                ))}
              </FormGroup>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddDayOfWeekRule}
                disabled={selectedDays.length === 0 || loading}
                size="small"
              >
                Add Day-of-Week Rule
              </Button>
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Specific Date Rule Section */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <EventIcon color="success" />
                <Typography variant="h6">
                  Specific Date Rules
                </Typography>
              </Box>

              {/* Single Date */}
              <Typography variant="subtitle2" gutterBottom>
                Single Date:
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
                <DatePicker
                  label="Select Date"
                  value={selectedDate}
                  onChange={setSelectedDate}
                  disabled={loading}
                  slotProps={{ textField: { size: 'small' } }}
                />
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleAddSpecificDate}
                  disabled={!selectedDate || loading}
                  size="small"
                >
                  Add Date
                </Button>
              </Box>

              {/* Date Range */}
              <Typography variant="subtitle2" gutterBottom>
                Date Range:
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <DatePicker
                  label="Start Date"
                  value={dateRangeStart}
                  onChange={setDateRangeStart}
                  disabled={loading}
                  slotProps={{ textField: { size: 'small' } }}
                />
                <DatePicker
                  label="End Date"
                  value={dateRangeEnd}
                  onChange={setDateRangeEnd}
                  disabled={loading}
                  slotProps={{ textField: { size: 'small' } }}
                />
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleAddDateRange}
                  disabled={!dateRangeStart || !dateRangeEnd || loading}
                  size="small"
                >
                  Add Date Range
                </Button>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default ApplicationRuleDialog;
