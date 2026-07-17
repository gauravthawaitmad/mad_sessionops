'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Clock, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { SlotItem, DayOfWeek } from '@/lib/api/services/slots.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

export function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${mStr} ${ampm}`;
}

// ── Component ──────────────────────────────────────────────────────────────────

interface SlotCardProps {
  slot: SlotItem;
  canModify?: boolean;
  onEdit?: (slot: SlotItem) => void;
  onDelete?: (slot: SlotItem) => void;
}

export function SlotCard({ slot, canModify = false, onEdit, onDelete }: SlotCardProps) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  function handleMenuOpen(e: React.MouseEvent<HTMLElement>) {
    e.stopPropagation();
    setAnchor(e.currentTarget);
  }

  function handleMenuClose() {
    setAnchor(null);
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2,
        py: 1.5,
        borderRadius: '10px',
        border: '1px solid #E2E8F0',
        bgcolor: '#fff',
        '&:hover': { bgcolor: '#F8FAFC', borderColor: '#CBD5E1' },
        transition: 'background-color 0.15s, border-color 0.15s',
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '8px',
          bgcolor: '#FFF7ED',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Clock size={16} strokeWidth={1.5} color="#EA580C" />
      </Box>

      {/* Slot name + time */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#1E293B',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {slot.slotName}
        </Typography>
        <Typography sx={{ fontSize: '12px', color: '#64748B', mt: 0.25 }}>
          {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
        </Typography>
      </Box>

      {/* Class count badge */}
      {slot.slotClassCount > 0 && (
        <Box
          sx={{
            px: 1.25,
            py: 0.375,
            borderRadius: '20px',
            bgcolor: '#F1F5F9',
            border: '1px solid #E2E8F0',
            flexShrink: 0,
          }}
        >
          <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
            {slot.slotClassCount} {slot.slotClassCount === 1 ? 'class' : 'classes'}
          </Typography>
        </Box>
      )}

      {/* Three-dot menu */}
      {canModify && (
        <>
          <IconButton
            size="small"
            onClick={handleMenuOpen}
            sx={{ color: '#94A3B8', '&:hover': { bgcolor: '#F1F5F9', color: '#475569' } }}
          >
            <MoreVertical size={16} />
          </IconButton>

          <Menu
            anchorEl={anchor}
            open={Boolean(anchor)}
            onClose={handleMenuClose}
            PaperProps={{ sx: { borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', minWidth: 140 } }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem
              onClick={() => { handleMenuClose(); onEdit?.(slot); }}
              sx={{ fontSize: '13px', gap: 1.25, py: 1 }}
            >
              <Pencil size={14} color="#475569" />
              Edit
            </MenuItem>
            <MenuItem
              onClick={() => { handleMenuClose(); onDelete?.(slot); }}
              sx={{ fontSize: '13px', gap: 1.25, py: 1, color: '#EF4444' }}
            >
              <Trash2 size={14} />
              Delete
            </MenuItem>
          </Menu>
        </>
      )}
    </Box>
  );
}
