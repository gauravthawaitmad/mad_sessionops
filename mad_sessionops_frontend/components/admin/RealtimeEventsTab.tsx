'use client';

import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import CircularProgress from '@mui/material/CircularProgress';
import { RefreshCw, Zap } from 'lucide-react';
import { RealtimeEventList } from './RealtimeEventList';
import { RealtimeEventDetail } from './RealtimeEventDetail';
import { SyncUserByPayloadModal } from './SyncUserByPayloadModal';
import { listRealtimeEvents } from '@/lib/api/services/realtimeSync.service';
import type { RealtimeSyncLogEntry } from '@/lib/api/services/realtimeSync.service';

const BORDER = '#E2E8F0';
const PAGE_SIZE = 25;

interface Filters {
  status: string;
  sync_type: string;
  event_type: string;
  user_id_from_source: string;
  date_from: string;
  date_to: string;
  page: number;
}

const INITIAL_FILTERS: Filters = {
  status: '',
  sync_type: '',
  event_type: '',
  user_id_from_source: '',
  date_from: '',
  date_to: '',
  page: 1,
};

export function RealtimeEventsTab() {
  const [filters, setFilters]           = useState<Filters>(INITIAL_FILTERS);
  const [events, setEvents]             = useState<RealtimeSyncLogEntry[]>([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [refreshing, setRefreshing]     = useState(false);

  const load = useCallback(async (f: Filters) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | undefined> = {
        page: f.page,
        page_size: PAGE_SIZE,
      };
      if (f.status)               params.status = f.status;
      if (f.sync_type)            params.sync_type = f.sync_type;
      if (f.event_type)           params.event_type = f.event_type;
      if (f.user_id_from_source)  params.user_id_from_source = Number(f.user_id_from_source);
      if (f.date_from)            params.date_from = new Date(f.date_from).toISOString();
      if (f.date_to)              params.date_to = new Date(f.date_to).toISOString();

      const res = await listRealtimeEvents(params as Parameters<typeof listRealtimeEvents>[0]);
      setEvents(res.results);
      setTotal(res.total);
    } catch {
      setError('Failed to load realtime events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(filters); }, []);

  function applyFilters() {
    const next = { ...filters, page: 1 };
    setFilters(next);
    load(next);
  }

  function clearFilters() {
    setFilters(INITIAL_FILTERS);
    load(INITIAL_FILTERS);
  }

  function handlePageChange(page: number) {
    const next = { ...filters, page };
    setFilters(next);
    load(next);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await load(filters);
    setRefreshing(false);
  }

  const hasFilters = Object.entries(filters).some(
    ([k, v]) => k !== 'page' && v !== ''
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <Box
        sx={{
          px: 2.5, py: 1.5,
          borderBottom: `1px solid ${BORDER}`,
          bgcolor: '#FAFBFC',
          display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        {/* Status filter */}
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel sx={{ fontSize: '12px' }}>Status</InputLabel>
          <Select
            value={filters.status}
            label="Status"
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            sx={{ fontSize: '12px' }}
          >
            <MenuItem value="" sx={{ fontSize: '12px' }}>All</MenuItem>
            <MenuItem value="success" sx={{ fontSize: '12px' }}>success</MenuItem>
            <MenuItem value="partial_success" sx={{ fontSize: '12px' }}>partial_success</MenuItem>
            <MenuItem value="failed" sx={{ fontSize: '12px' }}>failed</MenuItem>
            <MenuItem value="skipped_no_change" sx={{ fontSize: '12px' }}>skipped_no_change</MenuItem>
            <MenuItem value="skipped_stale" sx={{ fontSize: '12px' }}>skipped_stale</MenuItem>
            <MenuItem value="skipped_role_not_allowed" sx={{ fontSize: '12px' }}>skipped_role_not_allowed</MenuItem>
          </Select>
        </FormControl>

        {/* Event type filter */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel sx={{ fontSize: '12px' }}>Event type</InputLabel>
          <Select
            value={filters.event_type}
            label="Event type"
            onChange={(e) => setFilters({ ...filters, event_type: e.target.value })}
            sx={{ fontSize: '12px' }}
          >
            <MenuItem value="" sx={{ fontSize: '12px' }}>All</MenuItem>
            <MenuItem value="insert" sx={{ fontSize: '12px' }}>insert</MenuItem>
            <MenuItem value="update" sx={{ fontSize: '12px' }}>update</MenuItem>
            <MenuItem value="deactivate" sx={{ fontSize: '12px' }}>deactivate</MenuItem>
          </Select>
        </FormControl>

        {/* Sync type filter */}
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel sx={{ fontSize: '12px' }}>Sync type</InputLabel>
          <Select
            value={filters.sync_type}
            label="Sync type"
            onChange={(e) => setFilters({ ...filters, sync_type: e.target.value })}
            sx={{ fontSize: '12px' }}
          >
            <MenuItem value="" sx={{ fontSize: '12px' }}>All</MenuItem>
            <MenuItem value="manual_admin" sx={{ fontSize: '12px' }}>manual_admin</MenuItem>
            <MenuItem value="realtime_webhook" sx={{ fontSize: '12px' }}>realtime_webhook</MenuItem>
            <MenuItem value="cron_fallback" sx={{ fontSize: '12px' }}>cron_fallback</MenuItem>
          </Select>
        </FormControl>

        {/* User ID filter */}
        <TextField
          size="small"
          label="User ID"
          placeholder="e.g. 12345"
          value={filters.user_id_from_source}
          onChange={(e) => setFilters({ ...filters, user_id_from_source: e.target.value.replace(/\D/g, '') })}
          inputProps={{ maxLength: 12 }}
          sx={{ width: 120, '& .MuiInputBase-input': { fontSize: '12px' } }}
        />

        {/* Date range */}
        <TextField
          size="small"
          label="From"
          type="date"
          value={filters.date_from}
          onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 145, '& .MuiInputBase-input': { fontSize: '12px' } }}
        />
        <TextField
          size="small"
          label="To"
          type="date"
          value={filters.date_to}
          onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 145, '& .MuiInputBase-input': { fontSize: '12px' } }}
        />

        {/* Apply / Clear */}
        <Button
          size="small"
          variant="contained"
          onClick={applyFilters}
          sx={{ fontSize: '11px', textTransform: 'none', alignSelf: 'center' }}
        >
          Apply
        </Button>
        {hasFilters && (
          <Button
            size="small"
            variant="outlined"
            onClick={clearFilters}
            sx={{ fontSize: '11px', textTransform: 'none', alignSelf: 'center' }}
          >
            Clear
          </Button>
        )}

        <Box sx={{ flex: 1 }} />

        {/* Sync user button */}
        <Button
          size="small"
          variant="outlined"
          startIcon={<Zap size={12} />}
          onClick={() => setShowSyncModal(true)}
          sx={{
            fontSize: '11px', textTransform: 'none', alignSelf: 'center',
            borderColor: '#7C3AED', color: '#7C3AED',
            '&:hover': { borderColor: '#6D28D9', bgcolor: '#F5F3FF' },
          }}
        >
          Sync user
        </Button>

        {/* Refresh */}
        <Button
          size="small"
          variant="outlined"
          startIcon={refreshing ? <CircularProgress size={11} color="inherit" /> : <RefreshCw size={11} />}
          onClick={handleRefresh}
          disabled={refreshing}
          sx={{
            fontSize: '11px', textTransform: 'none', alignSelf: 'center',
            borderColor: BORDER, color: '#475569',
            '&:hover': { borderColor: '#94A3B8', bgcolor: '#F8FAFC' },
          }}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </Box>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading && !refreshing && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {error && (
          <Box sx={{ p: 3 }}>
            <Typography sx={{ fontSize: '13px', color: '#DC2626' }}>{error}</Typography>
          </Box>
        )}

        {!loading && !error && (
          <>
            {/* Count header */}
            <Box
              sx={{
                px: 2.5, py: 1,
                borderBottom: `1px solid ${BORDER}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
                {total === 0 ? 'No events' : `${total.toLocaleString()} event${total === 1 ? '' : 's'}`}
              </Typography>
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <RealtimeEventList
                events={events}
                total={total}
                page={filters.page}
                pageSize={PAGE_SIZE}
                onPageChange={handlePageChange}
                onRowClick={(id) => setSelectedLogId(id)}
              />
            </Box>
          </>
        )}
      </Box>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <RealtimeEventDetail
        logId={selectedLogId}
        onClose={() => setSelectedLogId(null)}
      />

      <SyncUserByPayloadModal
        open={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        onSuccess={() => {
          setShowSyncModal(false);
          load(filters);
        }}
      />
    </Box>
  );
}
