'use client';

import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import toast from 'react-hot-toast';
import { manualSyncUser } from '@/lib/api/services/realtimeSync.service';
import type { ManualSyncResult } from '@/lib/api/services/realtimeSync.service';

interface SyncUserByPayloadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EVENT_TYPES = ['insert', 'update', 'deactivate'] as const;

const EXAMPLE_PAYLOAD = `{
  "user_id": 12345,
  "user_login": "volunteer@makeadiff.in",
  "user_display_name": "Test Volunteer",
  "user_role": "Youth",
  "worknode_id": null,
  "is_active": true
}`;

export function SyncUserByPayloadModal({ open, onClose, onSuccess }: SyncUserByPayloadModalProps) {
  const [payloadText, setPayloadText]   = useState('');
  const [eventType, setEventType]       = useState<string>('update');
  const [loading, setLoading]           = useState(false);
  const [jsonError, setJsonError]       = useState<string | null>(null);
  const [result, setResult]             = useState<ManualSyncResult | null>(null);

  function handleClose() {
    if (loading) return;
    setPayloadText('');
    setEventType('update');
    setJsonError(null);
    setResult(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setJsonError(null);
    setResult(null);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(payloadText);
    } catch {
      setJsonError('Invalid JSON — please check your payload');
      return;
    }

    const payload = {
      ...parsed,
      event_type: eventType,
      sync_type: 'manual_admin',
    };

    setLoading(true);
    try {
      const res = await manualSyncUser(payload);
      setResult(res);
      onSuccess();
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status;
      const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Sync failed';
      if (status === 400) {
        setJsonError(msg);
      } else if (status === 403) {
        toast.error('You do not have permission to perform this action.');
        handleClose();
      } else {
        toast.error('Sync failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ fontSize: '15px', fontWeight: 600, pb: 1 }}>
          Manual sync user
        </DialogTitle>

        <DialogContent sx={{ pb: 1 }}>
          <Typography sx={{ fontSize: '12px', color: '#64748B', mb: 2 }}>
            Paste an enriched user payload (from Hasura or a log entry). Include{' '}
            <Box component="span" sx={{ fontFamily: 'monospace', bgcolor: '#F1F5F9', px: 0.5, borderRadius: '3px' }}>
              user_id
            </Box>{' '}
            in the JSON. The{' '}
            <Box component="span" sx={{ fontFamily: 'monospace', bgcolor: '#F1F5F9', px: 0.5, borderRadius: '3px' }}>
              event_type
            </Box>{' '}
            and{' '}
            <Box component="span" sx={{ fontFamily: 'monospace', bgcolor: '#F1F5F9', px: 0.5, borderRadius: '3px' }}>
              sync_type
            </Box>{' '}
            fields are set below and will override any values in the JSON.
          </Typography>

          {/* Event type selector */}
          <FormControl size="small" sx={{ mb: 2, minWidth: 160 }}>
            <InputLabel sx={{ fontSize: '12px' }}>Event type</InputLabel>
            <Select
              value={eventType}
              label="Event type"
              onChange={(e) => setEventType(e.target.value)}
              disabled={loading}
              sx={{ fontSize: '12px' }}
            >
              {EVENT_TYPES.map((t) => (
                <MenuItem key={t} value={t} sx={{ fontSize: '12px' }}>{t}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Payload textarea */}
          <TextField
            multiline
            fullWidth
            rows={10}
            label="Payload JSON"
            placeholder={EXAMPLE_PAYLOAD}
            value={payloadText}
            onChange={(e) => {
              setPayloadText(e.target.value);
              setJsonError(null);
            }}
            disabled={loading}
            error={Boolean(jsonError)}
            helperText={jsonError ?? ''}
            inputProps={{ style: { fontFamily: 'monospace', fontSize: '12px' } }}
            size="small"
          />

          {/* Result panel */}
          {result && (
            <Box
              sx={{
                mt: 2, p: 1.5, bgcolor: result.status === 'failed' ? '#FEF2F2' : '#F0FDF4',
                borderRadius: '8px', border: `1px solid ${result.status === 'failed' ? '#FECACA' : '#BBF7D0'}`,
              }}
            >
              <Typography sx={{ fontSize: '12px', fontWeight: 700, color: result.status === 'failed' ? '#DC2626' : '#16A34A', mb: 0.5 }}>
                {result.status === 'failed' ? 'Failed' : 'Sync complete'}
              </Typography>
              <Typography sx={{ fontSize: '11px', color: '#475569' }}>
                Log #{result.log_id} · {result.action_taken.replace(/_/g, ' ')}
              </Typography>
              {result.error_details && (
                <Typography sx={{ fontSize: '11px', color: '#DC2626', mt: 0.5, fontFamily: 'monospace' }}>
                  {result.error_details}
                </Typography>
              )}
              {result.cascaded_changes && result.cascaded_changes.length > 0 && (
                <Typography sx={{ fontSize: '11px', color: '#475569', mt: 0.5 }}>
                  {result.cascaded_changes.length} cascaded change(s)
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={handleClose} disabled={loading} size="small" color="inherit">
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              type="submit"
              variant="contained"
              size="small"
              disabled={loading || !payloadText.trim()}
              startIcon={loading ? <CircularProgress size={14} color="inherit" /> : undefined}
            >
              {loading ? 'Syncing…' : 'Sync user'}
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
}
