'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { CheckCircle, XCircle, Loader, Users, Building2, Network, Clock, User, ChevronDown, ChevronUp } from 'lucide-react';
import type { SyncRunDetail, SyncedUserLogin, SyncedPartnerId } from '@/lib/api/services/syncAdmin.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  success: '#16A34A',
  failed:  '#DC2626',
  running: '#0284C7',
};
const STATUS_BG: Record<string, string> = {
  success: '#F0FDF4',
  failed:  '#FEF2F2',
  running: '#EFF6FF',
};
const STATUS_ICON: Record<string, React.ElementType> = {
  success: CheckCircle,
  failed:  XCircle,
  running: Loader,
};

const ENTITY_ICON: Record<string, React.ElementType> = {
  user:            Users,
  partner:         Building2,
  partner_worknode: Network,
};

const ENTITY_LABEL: Record<string, string> = {
  user:            'Users',
  partner:         'Partners',
  partner_worknode: 'Partner Worknodes',
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function fmtDuration(startedAt: string, completedAt: string | null, liveElapsed?: number): string {
  if (completedAt) {
    const secs = Math.round(
      (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000,
    );
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  }
  if (liveElapsed !== undefined) {
    if (liveElapsed < 60) return `${liveElapsed}s`;
    return `${Math.floor(liveElapsed / 60)}m ${liveElapsed % 60}s`;
  }
  return '—';
}

function n(v: number): string {
  return v.toLocaleString();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, py: 0.625, borderBottom: '1px solid #F8FAFC' }}>
      <Typography sx={{ fontSize: '11px', color: '#94A3B8', width: 130, flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: '11px', color: '#334155', wordBreak: 'break-all' }}>{value ?? '—'}</Typography>
    </Box>
  );
}

interface ActivityRowProps {
  entityType: string;
  status: string;
  fetched: number;
  created: number;
  updated: number;
  durationStr: string;
  isRunning: boolean;
  liveElapsed?: number;
  pwMode?: boolean;   // partner_worknode: show "N rows synced" instead of fetched/created/updated
}

function ActivityRow({ entityType, status, fetched, created, updated, durationStr, isRunning, liveElapsed, pwMode }: ActivityRowProps) {
  const Icon        = ENTITY_ICON[entityType] ?? Users;
  const label       = ENTITY_LABEL[entityType] ?? entityType;
  const color       = STATUS_COLOR[status] ?? '#64748B';
  const StatusIcon  = STATUS_ICON[status] ?? Loader;

  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'flex-start', gap: 1.5,
        py: 1, borderBottom: '1px solid #F1F5F9',
      }}
    >
      <StatusIcon
        size={13}
        color={color}
        strokeWidth={2}
        style={{
          marginTop: 2, flexShrink: 0,
          animation: isRunning ? 'spin 1.2s linear infinite' : undefined,
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.375 }}>
          <Icon size={12} color="#64748B" strokeWidth={1.75} />
          <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>{label}</Typography>
          {isRunning && (
            <Typography sx={{ fontSize: '10px', color: '#0284C7', fontWeight: 500 }}>
              {liveElapsed !== undefined ? `${liveElapsed}s elapsed` : 'running…'}
            </Typography>
          )}
        </Box>
        {status === 'success' && (
          <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
            {pwMode ? (
              fetched > 0 ? `${n(fetched)} rows synced (full sync)` : 'no rows — full sync'
            ) : (
              <>
                {n(fetched)} fetched
                {created > 0 && <> · <span style={{ color: '#16A34A' }}>{n(created)} new</span></>}
                {updated > 0 && <> · {n(updated)} updated</>}
                {fetched === 0 && created === 0 && updated === 0 && ' · no changes'}
              </>
            )}
          </Typography>
        )}
      </Box>
      <Typography sx={{ fontSize: '10px', color: '#94A3B8', flexShrink: 0, mt: 0.25 }}>
        {durationStr}
      </Typography>
    </Box>
  );
}

const PREVIEW_COUNT = 5;

function SyncedUsersList({ items, isSingle }: { items: SyncedUserLogin[]; isSingle: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, PREVIEW_COUNT);
  const hasMore = items.length > PREVIEW_COUNT;

  return (
    <>
      <Divider sx={{ my: 1.5 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
        <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em' }}>
          {isSingle ? 'SYNCED USER' : `SYNCED USERS (${items.length})`}
        </Typography>
      </Box>
      <Box
        sx={{
          border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden',
          bgcolor: '#FAFAFA',
        }}
      >
        {visible.map((item, i) => (
          <Box
            key={item.user_login}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.25,
              px: 1.5, py: 0.875,
              borderBottom: i < visible.length - 1 ? '1px solid #F1F5F9' : 'none',
              '&:hover': { bgcolor: '#F8FAFC' },
            }}
          >
            <Box
              sx={{
                width: 26, height: 26, borderRadius: '50%',
                bgcolor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <User size={12} color="#3B82F6" strokeWidth={2} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#0F172A', lineHeight: 1.3 }}>
                {item.user_name || '—'}
              </Typography>
              <Typography sx={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace', lineHeight: 1.4 }}>
                {item.user_login}
              </Typography>
            </Box>
          </Box>
        ))}
        {hasMore && (
          <Box
            onClick={() => setExpanded(e => !e)}
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
              px: 1.5, py: 0.75, cursor: 'pointer',
              borderTop: '1px solid #E2E8F0', bgcolor: '#F8FAFC',
              '&:hover': { bgcolor: '#F1F5F9' },
            }}
          >
            {expanded
              ? <><ChevronUp size={11} color="#64748B" /><Typography sx={{ fontSize: '10px', color: '#64748B' }}>Show less</Typography></>
              : <><ChevronDown size={11} color="#64748B" /><Typography sx={{ fontSize: '10px', color: '#64748B' }}>Show all {items.length} users</Typography></>
            }
          </Box>
        )}
      </Box>
    </>
  );
}

function SyncedPartnersList({ items }: { items: SyncedPartnerId[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, PREVIEW_COUNT);
  const hasMore = items.length > PREVIEW_COUNT;

  return (
    <>
      <Divider sx={{ my: 1.5 }} />
      <Box sx={{ mb: 0.75 }}>
        <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em' }}>
          SYNCED PARTNERS ({items.length})
        </Typography>
      </Box>
      <Box
        sx={{
          border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden',
          bgcolor: '#FAFAFA',
        }}
      >
        {visible.map((item, i) => (
          <Box
            key={item.partner_id}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.25,
              px: 1.5, py: 0.875,
              borderBottom: i < visible.length - 1 ? '1px solid #F1F5F9' : 'none',
              '&:hover': { bgcolor: '#F8FAFC' },
            }}
          >
            <Box
              sx={{
                width: 26, height: 26, borderRadius: '6px',
                bgcolor: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Building2 size={12} color="#16A34A" strokeWidth={2} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: '11px', fontWeight: 600, color: '#0F172A', lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
                title={item.partner_name}
              >
                {item.partner_name || '—'}
              </Typography>
              <Typography sx={{ fontSize: '10px', color: '#94A3B8', lineHeight: 1.4 }}>
                ID #{item.partner_id}
              </Typography>
            </Box>
          </Box>
        ))}
        {hasMore && (
          <Box
            onClick={() => setExpanded(e => !e)}
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
              px: 1.5, py: 0.75, cursor: 'pointer',
              borderTop: '1px solid #E2E8F0', bgcolor: '#F8FAFC',
              '&:hover': { bgcolor: '#F1F5F9' },
            }}
          >
            {expanded
              ? <><ChevronUp size={11} color="#64748B" /><Typography sx={{ fontSize: '10px', color: '#64748B' }}>Show less</Typography></>
              : <><ChevronDown size={11} color="#64748B" /><Typography sx={{ fontSize: '10px', color: '#64748B' }}>Show all {items.length} partners</Typography></>
            }
          </Box>
        )}
      </Box>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface SyncRunDetailProps {
  run: SyncRunDetail | null;
  loading: boolean;
}

export function SyncRunDetail({ run, loading }: SyncRunDetailProps) {
  const [elapsed, setElapsed] = useState(0);

  // Live elapsed counter — only ticks when run is actively running
  useEffect(() => {
    if (!run || run.status !== 'running') {
      setElapsed(0);
      return;
    }
    const startMs = new Date(run.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [run?.syncRunId, run?.status]);   // re-bind when run changes

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Loader size={14} color="#94A3B8" style={{ animation: 'spin 1.2s linear infinite' }} />
        <Typography sx={{ fontSize: '12px', color: '#94A3B8' }}>Loading…</Typography>
      </Box>
    );
  }

  if (!run) {
    return (
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Clock size={24} color="#CBD5E1" strokeWidth={1.5} style={{ marginBottom: 8 }} />
          <Typography sx={{ fontSize: '13px', color: '#94A3B8' }}>
            Select a run to view details
          </Typography>
        </Box>
      </Box>
    );
  }

  const isRunning   = run.status === 'running';
  const statusColor = STATUS_COLOR[run.status] ?? '#64748B';
  const statusBg    = STATUS_BG[run.status]    ?? '#F8FAFC';
  const StatusIcon  = STATUS_ICON[run.status]  ?? Loader;
  const entityLabel = ENTITY_LABEL[run.entityType ?? ''] ?? (run.entityType ?? '—');
  const duration    = fmtDuration(run.startedAt, run.completedAt, isRunning ? elapsed : undefined);

  // Determine which entity counts to show based on entity_type
  const showUserCounts    = run.entityType === 'user';
  const showPartnerCounts = run.entityType === 'partner';
  const showPWCounts      = run.entityType === 'partner_worknode';

  return (
    <Box sx={{ p: 2.5, overflowY: 'auto', height: '100%' }}>

      {/* Header: Run ID + status badge */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
          Run #{run.syncRunId}
        </Typography>
        <Box
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.5,
            px: 1, py: 0.375, borderRadius: '12px',
            bgcolor: statusBg, border: `1px solid ${statusColor}22`,
          }}
        >
          <StatusIcon
            size={11}
            color={statusColor}
            strokeWidth={2}
            style={{ animation: isRunning ? 'spin 1.2s linear infinite' : undefined }}
          />
          <Typography sx={{ fontSize: '10px', fontWeight: 600, color: statusColor, textTransform: 'capitalize' }}>
            {isRunning ? `${elapsed}s` : run.status}
          </Typography>
        </Box>
      </Box>

      {/* Activity section */}
      <Box
        sx={{
          bgcolor: '#F8FAFC', border: '1px solid #E2E8F0',
          borderRadius: '8px', p: 1.5, mb: 2,
        }}
      >
        <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', mb: 0.75 }}>
          ACTIVITY
        </Typography>

        {showUserCounts && (
          <ActivityRow
            entityType="user"
            status={run.status}
            fetched={run.usersFetched}
            created={run.usersCreated}
            updated={run.usersUpdated}
            durationStr={duration}
            isRunning={isRunning}
            liveElapsed={isRunning ? elapsed : undefined}
          />
        )}
        {showPartnerCounts && (
          <ActivityRow
            entityType="partner"
            status={run.status}
            fetched={run.partnersFetched}
            created={run.partnersCreated}
            updated={run.partnersUpdated}
            durationStr={duration}
            isRunning={isRunning}
            liveElapsed={isRunning ? elapsed : undefined}
          />
        )}
        {showPWCounts && (
          <ActivityRow
            entityType="partner_worknode"
            status={run.status}
            fetched={run.recordsFetched}   // stored in users_fetched; resolver sums it
            created={0}
            updated={0}
            durationStr={duration}
            isRunning={isRunning}
            liveElapsed={isRunning ? elapsed : undefined}
            pwMode                         // suppress "created/updated" labels, show "synced" instead
          />
        )}
        {!showUserCounts && !showPartnerCounts && !showPWCounts && (
          <ActivityRow
            entityType="user"
            status={run.status}
            fetched={run.recordsFetched}
            created={0}
            updated={0}
            durationStr={duration}
            isRunning={isRunning}
            liveElapsed={isRunning ? elapsed : undefined}
          />
        )}
      </Box>

      {/* Metadata */}
      <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', mb: 0.75 }}>
        METADATA
      </Typography>
      <MetaRow label="Entity"        value={entityLabel} />
      <MetaRow label="Trigger type"  value={run.syncType ?? '—'} />
      <MetaRow label="Started"       value={fmtDate(run.startedAt)} />
      <MetaRow label="Completed"     value={isRunning ? 'Running…' : fmtDate(run.completedAt)} />
      <MetaRow label="Cursor used"    value={fmtDate(run.updatedAfter)} />
      <MetaRow label="Cursor end"     value={run.cursorEnd ? fmtDate(run.cursorEnd) : (run.status === 'success' ? '— no date field in response' : '—')} />
      {run.targetIdentifier && <MetaRow label="Target login" value={run.targetIdentifier} />}
      {run.triggeredByName  && <MetaRow label="Triggered by" value={
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <User size={10} color="#64748B" />
          {run.triggeredByName}
        </Box>
      } />}

      {/* Error */}
      {run.errorDetails && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#DC2626', letterSpacing: '0.08em', mb: 0.5 }}>
            ERROR
          </Typography>
          <Box
            sx={{
              bgcolor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px',
              p: 1.25, fontSize: '11px', fontFamily: 'monospace', color: '#991B1B',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}
          >
            {run.errorDetails}
          </Box>
        </>
      )}

      {/* Synced users list */}
      {run.userLogins && run.userLogins.length > 0 && (
        <SyncedUsersList
          items={run.userLogins}
          isSingle={run.syncType === 'manual_single_user'}
        />
      )}

      {/* Synced partners list */}
      {run.partnerIds && run.partnerIds.length > 0 && (
        <SyncedPartnersList items={run.partnerIds} />
      )}
    </Box>
  );
}
