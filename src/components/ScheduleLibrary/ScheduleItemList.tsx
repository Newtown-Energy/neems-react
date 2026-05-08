import React, { useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type {
  ApplicationRule,
  ScheduleCommandDto,
  ScheduleLibraryItem
} from '@newtown-energy/types';
import ScheduleItemCard from './ScheduleItemCard';

interface ScheduleItemListProps {
  items: ScheduleLibraryItem[];
  rulesByItemId: (itemId: number) => ApplicationRule[];
  onSaveItem: (
    id: number,
    data: { name: string; description: string | null; commands: ScheduleCommandDto[] }
  ) => Promise<void>;
  onDeleteItem: (item: ScheduleLibraryItem) => void;
  onManageRules?: (item: ScheduleLibraryItem) => void;
  onViewSpecificDates: (itemId: number) => void;
  onError?: (message: string) => void;
}

const ScheduleItemList: React.FC<ScheduleItemListProps> = ({
  items,
  rulesByItemId,
  onSaveItem,
  onDeleteItem,
  onManageRules,
  onViewSpecificDates,
  onError
}) => {
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', p: 4 }}>
        <Typography variant="body1" color="text.secondary">
          No schedules in library. Click "New Schedule" to create one.
        </Typography>
      </Box>
    );
  }

  const sorted = [...items].sort((a, b) => {
    const aIsDefault = rulesByItemId(a.id).some(r => r.rule_type === 'default');
    const bIsDefault = rulesByItemId(b.id).some(r => r.rule_type === 'default');
    if (aIsDefault && !bIsDefault) return -1;
    if (!aIsDefault && bIsDefault) return 1;
    return 0;
  });

  return (
    <Stack spacing={2}>
      {sorted.map(item => {
        const rules = rulesByItemId(item.id);
        const isDefault = rules.some(r => r.rule_type === 'default');
        return (
          <ScheduleItemCard
            key={item.id}
            item={item}
            rules={rules}
            isDefault={isDefault}
            isExpanded={expandedItemId === item.id}
            onToggleExpand={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
            onSave={onSaveItem}
            onDelete={onDeleteItem}
            onManageRules={onManageRules}
            onViewSpecificDates={onViewSpecificDates}
            onError={onError}
          />
        );
      })}
    </Stack>
  );
};

export default ScheduleItemList;
