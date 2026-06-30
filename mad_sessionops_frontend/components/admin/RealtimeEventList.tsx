'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { CheckCircle, XCircle, Loader, SkipForward, AlertTriangle } from 'lucide-react';
import type { RealtimeSyncLogEntry } from '@/lib/api/services/realtimeSync.service';

interface RealtimeEventListProps {
  events: RealtimeSyncLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onRowClick: (logId: number) => void;
}

const BORDER = '#E2E8F0';

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  success:                '#16A34A',
  partial_success:        '#D97706',
  failed:                 '#DC2626',
  skipped_no_change:      '#94A3B8',
  skipped_stale:          '#94A3B8',
  skipped_role_not_allowed: '#94A3B8',
  running:                '#0284C7',
};

const STATUS_BG: Record<string, string> = {
  success:                '#F0FDF4',
  partial_success:        '#FFFBEB',
  failed:                 '#FEF2F2',
  skipped_no_change:      '#F8FAFC',
  skipped_stale:          '#F8FAFC',
  skipped_role_not_allowed: '#F8FAFC',
  running:                '#EFF6FF',
};

const STATUS_ICON: Record<string, React.ElementType> = {
  success:                CheckCircle,
  partial_success:        AlertTriangle,
  failed:                 XCircle,
  skipped_no_change:      SkipForward,
  skipped_stale:          SkipForward,
  skipped_role_not_allowed: SkipForward,
  running:                Loader,
};

function StatusBadge({ status }: { status: string }) {
  const color  = STATUS_COLOR[status] ?? '#64748B';
  const bg     = STATUS_BG[status]    ?? '#F8FAFC';
  const Icon   = STATUS_ICON[status]  ?? CheckCircle;
  const label  = status.replace(/_/g, ' ');
  return (
    <Box
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.375,
        px: 0.75, py: 0.25, borderRadius: '4px', bgcolor: bg,
      }}
    >
      <Icon
        size={10}
        color={color}
        strokeWidth={2}
        style={{ animation: status === 'running' ? 'spin 1.2s linear infinite' : undefined }}
      />
      <Typography sx={{ fontSize: '10px', fontWeight: 600, color, textTransform: 'capitalize' }}>
        {label}
      </Typography>
    </Box>
  );
}

// ── Timestamp ─────────────────────────────────────────────────────────────────

function fmtTs(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const isSameDay = d.toDateString() === now.toDateString();
    if (isSameDay) {
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

export function RealtimeEventList({
  events,
  total,
  page,
  pageSize,
  onPageChange,
  onRowClick,
}: RealtimeEventListProps) {
  const totalPages = Math.ceil(total / pageSize);

  if (events.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '12px', color: '#94A3B8' }}>No events found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Table */}
      <Box sx={{ flex: 1, overflowX: 'auto' }}>
        <Box
          component="table"
          sx={{
            width: '100%', borderCollapse: 'collapse',
            '& th, & td': {
              px: 1.5, py: 1, textAlign: 'left',
              borderBottom: `1px solid ${BORDER}`,
              fontSize: '12px', whiteSpace: 'nowrap',
            },
            '& th': { bgcolor: '#FAFBFC', fontWeight: 700, color: '#64748B', fontSize: '11px' },
            '& tbody tr': { cursor: 'pointer', transition: 'background 0.1s' },
            '& tbody tr:hover': { bgcolor: '#F8FAFC' },
          }}
        >
          <thead>
            <tr>
              <th>Log ID</th>
              <th>User ID</th>
              <th>Event</th>
              <th>Received</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.realtime_sync_log_id} onClick={() => onRowClick(ev.realtime_sync_log_id)}>
                <td>
                  <Typography sx={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace' }}>
                    #{ev.realtime_sync_log_id}
                  </Typography>
                </td>
                <td>
                  <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#0F172A' }}>
                    {ev.user_id_from_source}
                  </Typography>
                </td>
                <td>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.125 }}>
                    <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                      {ev.event_type}
                    </Typography>
                    <Typography sx={{ fontSize: '10px', color: '#94A3B8' }}>
                      {ev.sync_type}
                    </Typography>
                  </Box>
                </td>
                <td>
                  <Typography sx={{ fontSize: '11px', color: '#475569' }}>
                    {fmtTs(ev.received_at)}
                  </Typography>
                </td>
                <td>
                  <StatusBadge status={ev.status} />
                </td>
                <td>
                  <Typography sx={{ fontSize: '11px', color: '#475569' }}>
                    {ev.action_taken.replace(/_/g, ' ')}
                  </Typography>
                </td>
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box
          sx={{
            px: 2, py: 1, borderTop: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
            {total} total · page {page} of {totalPages}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <Button
              size="small"
              variant="outlined"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              sx={{ fontSize: '11px', textTransform: 'none', minWidth: 0, px: 1, py: 0.25 }}
            >
              Prev
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              sx={{ fontSize: '11px', textTransform: 'none', minWidth: 0, px: 1, py: 0.25 }}
            >
              Next
            </Button>
          </Box>
        </Box>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </Box>
  );
}
