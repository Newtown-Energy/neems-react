/**
 * Application Rule Dialog Component
 *
 * Streamlined dialog for managing application rules for a schedule library item.
 * Supports default rules, day-of-week recurring rules, and viewing date overrides.
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
  CircularProgress,
  Collapse
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Star as StarIcon,
  Loop as LoopIcon,
  Event as EventIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';

import type { ScheduleLibraryItem } from '../../types/generated/ScheduleLibraryItem';
import type { ApplicationRule } from '../../types/generated/ApplicationRule';
import {
  getApplicationRules,
  createApplicationRule,
  deleteApplicationRule
} from '../../utils/scheduleApi';

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

  // Day of week rule state (merged from all day-of-week rules)
  const [activeDays, setActiveDays] = useState<Set<number>>(new Set());

  // Date overrides state
  const [dateOverridesExpanded, setDateOverridesExpanded] = useState(false);
  const [specificDateRules, setSpecificDateRules] = useState<ApplicationRule[]>([]);

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
      // Get rules for this item
      const fetchedRules = await getApplicationRules(libraryItem.id);
      setRules(fetchedRules);

      // Check if this item is currently default
      const defaultRule = fetchedRules.find(r => r.rule_type === 'default');
      setIsDefault(!!defaultRule);

      // Merge all day-of-week rules into a single set
      const dayOfWeekRules = fetchedRules.filter(r => r.rule_type === 'day_of_week');
      const mergedDays = new Set<number>();
      dayOfWeekRules.forEach(rule => {
        rule.days_of_week?.forEach(day => mergedDays.add(day));
      });
      setActiveDays(mergedDays);

      // Get specific date rules
      const specificRules = fetchedRules.filter(r => r.rule_type === 'specific_date');
      setSpecificDateRules(specificRules);
    } catch (err) {
      setError('Failed to load rules');
      console.error('Error loading rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDayToggle = async (dayIndex: number) => {
    if (!libraryItem || loading) return;

    const newActiveDays = new Set(activeDays);
    if (newActiveDays.has(dayIndex)) {
      newActiveDays.delete(dayIndex);
    } else {
      newActiveDays.add(dayIndex);
    }

    setLoading(true);
    setError(null);
    try {
      // Delete all existing day-of-week rules
      const dayOfWeekRules = rules.filter(r => r.rule_type === 'day_of_week');
      for (const rule of dayOfWeekRules) {
        await deleteApplicationRule(rule.id);
      }

      // Create new day-of-week rule with all active days (if any)
      if (newActiveDays.size > 0) {
        await createApplicationRule(libraryItem.id, {
          rule_type: 'day_of_week',
          days_of_week: Array.from(newActiveDays).sort((a, b) => a - b),
          specific_dates: null,
          override_reason: null
        });
      }

      setActiveDays(newActiveDays);
      await loadRules();
      onRulesChanged?.();
    } catch (err) {
      setError('Failed to update recurring rules');
      console.error('Error updating recurring rules:', err);
      // Reload to restore previous state
      await loadRules();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSpecificDateRule = async (ruleId: number) => {
    setLoading(true);
    setError(null);
    try {
      await deleteApplicationRule(ruleId);
      await loadRules();
      onRulesChanged?.();
    } catch (err) {
      setError('Failed to delete date override');
      console.error('Error deleting date override:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatSpecificDateDetails = (rule: ApplicationRule): string => {
    if (rule.specific_dates) {
      if (rule.specific_dates.length === 1) {
        return rule.specific_dates[0];
      }
      return `${rule.specific_dates.length} dates: ${rule.specific_dates[0]} to ${rule.specific_dates[rule.specific_dates.length - 1]}`;
    }
    return '';
  };

  const totalSpecificDates = specificDateRules.reduce((sum, rule) => sum + (rule.specific_dates?.length || 0), 0);

  return (
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

          {loading && rules.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Universal Default Section */}
              {isDefault && (
                <Box sx={{ mb: 3 }}>
                  <Alert severity="info" icon={<StarIcon />}>
                    This is the Default Schedule. It applies to all dates unless overridden by a recurring rule or date-specific override.
                  </Alert>
                </Box>
              )}

              {/* Only show Recurring Rules section if NOT the default schedule */}
              {!isDefault && (
                <>

                  {/* Recurring Rules Section */}
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <LoopIcon color="secondary" />
                      <Typography variant="h6">
                        Recurring Rules
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
                      Select which days of the week this schedule should apply to:
                    </Typography>
                    <FormGroup row>
                      {DAY_NAMES.map((dayName, index) => (
                        <FormControlLabel
                          key={dayName}
                          control={
                            <Checkbox
                              checked={activeDays.has(index)}
                              onChange={() => handleDayToggle(index)}
                              disabled={loading}
                            />
                          }
                          label={dayName.substring(0, 3)}
                        />
                      ))}
                    </FormGroup>
                  </Box>
                </>
              )}

              <Divider sx={{ my: 3 }} />

              {/* Date Overrides Section */}
              <Box sx={{ mb: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    p: 1,
                    borderRadius: 1,
                    mb: 1
                  }}
                  onClick={() => setDateOverridesExpanded(!dateOverridesExpanded)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EventIcon color="success" />
                    <Typography variant="h6">
                      Date Overrides
                    </Typography>
                    {totalSpecificDates > 0 && (
                      <Typography variant="body2" color="text.secondary">
                        ({totalSpecificDates} date{totalSpecificDates !== 1 ? 's' : ''})
                      </Typography>
                    )}
                  </Box>
                  {dateOverridesExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </Box>

                <Collapse in={dateOverridesExpanded}>
                  <Box sx={{ pl: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                      Date overrides take precedence over default and recurring rules. This schedule has been applied to the dates listed below.
                    </Typography>
                    {specificDateRules.length > 0 ? (
                      <List>
                        {specificDateRules.map(rule => (
                          <ListItem key={rule.id} divider>
                            <ListItemText
                              primary={formatSpecificDateDetails(rule)}
                              secondary={
                                rule.override_reason ? (
                                  <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                                    <Typography component="span" variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                                      Reason:{' '}
                                    </Typography>
                                    <Typography component="span" variant="body2" color="text.secondary">
                                      {rule.override_reason}
                                    </Typography>
                                  </Box>
                                ) : undefined
                              }
                            />
                            <ListItemSecondaryAction>
                              <IconButton
                                edge="end"
                                onClick={() => handleDeleteSpecificDateRule(rule.id)}
                                color="error"
                                disabled={loading}
                                size="small"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </ListItemSecondaryAction>
                          </ListItem>
                        ))}
                      </List>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No date overrides. Create overrides from the calendar view.
                      </Typography>
                    )}
                  </Box>
                </Collapse>
              </Box>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApplicationRuleDialog;
