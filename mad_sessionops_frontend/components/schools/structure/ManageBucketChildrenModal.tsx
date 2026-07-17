'use client';

import { useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import { X, Search, Plus, Minus, Users } from 'lucide-react';
import { fetchChildren, type ChildItem } from '@/lib/api/services/children.service';
import { addChildToBucket, removeChildFromBucket, type BucketItem } from '@/lib/api/services/buckets.service';
import { showSuccess } from '@/lib/toast/toast';

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_CAPACITY = 5;
const BORDER      = '#E2E8F0';
const LABEL       = '#374151';
const TEXT_MUTED  = '#94A3B8';
const TEXT_STRONG = '#0F172A';
const DANGER      = '#EF4444';
const ACCENT      = '#2563EB';

// ── FieldLabel ────────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: string }) {
  return (
    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: LABEL, mb: 0.625, letterSpacing: '0.01em' }}>
      {children}
    </Typography>
  );
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function RowSkeletons({ count = 3 }: { count?: number }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={40} sx={{ borderRadius: '8px' }} />
      ))}
    </Box>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ManageBucketChildrenModalProps {
  open: boolean;
  schoolId: number;
  bucket: BucketItem;
  onClose: () => void;
  onChildAdded: () => void;
  onChildRemoved: () => void;
}

export function ManageBucketChildrenModal({
  open,
  schoolId,
  bucket,
  onClose,
  onChildAdded,
  onChildRemoved,
}: ManageBucketChildrenModalProps) {
  const [roster, setRoster] = useState<ChildItem[]>([]);
  const [available, setAvailable] = useState<ChildItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const name = bucket.sectionDisplayName ?? bucket.sectionName;
  const atCapacity = bucket.activeChildrenCount >= MAX_CAPACITY;

  useEffect(() => {
    if (!open) return;
    setError('');
    setSearch('');
    setLoading(true);
    Promise.all([
      fetchChildren(schoolId, { section_id: bucket.classSectionId, status: 'active' }),
      fetchChildren(schoolId, { status: 'active' }),
    ])
      .then(([rosterData, allActive]) => {
        setRoster(rosterData);
        setAvailable(allActive.filter((c) => c.currentSection == null));
      })
      .catch(() => setError('Failed to load children.'))
      .finally(() => setLoading(false));
  }, [open, schoolId, bucket.classSectionId]);

  async function handleAdd(child: ChildItem) {
    setPendingId(child.childId);
    setError('');
    try {
      await addChildToBucket(schoolId, bucket.classSectionId, child.childId);
      setRoster((prev) => [...prev, child]);
      setAvailable((prev) => prev.filter((c) => c.childId !== child.childId));
      onChildAdded();
      showSuccess(`${child.firstName} added to ${name}`);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to add child.');
    } finally {
      setPendingId(null);
    }
  }

  async function handleRemove(child: ChildItem) {
    setPendingId(child.childId);
    setError('');
    try {
      await removeChildFromBucket(schoolId, bucket.classSectionId, child.childId);
      setRoster((prev) => prev.filter((c) => c.childId !== child.childId));
      setAvailable((prev) => [...prev, child]);
      onChildRemoved();
      showSuccess(`${child.firstName} removed from ${name}`);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to remove child.');
    } finally {
      setPendingId(null);
    }
  }

  function handleClose() {
    setSearch('');
    setError('');
    onClose();
  }

  const filteredAvailable = available.filter((c) =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      TransitionProps={{ onEntered: () => searchRef.current?.focus() }}
      PaperProps={{ sx: { borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', maxHeight: '85vh' } }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          px: 3,
          pt: 2.5,
          pb: 1.5,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <Box>
          <Typography sx={{ fontSize: '15px', fontWeight: 700, color: TEXT_STRONG }}>
            Manage Children
          </Typography>
          <Typography sx={{ fontSize: '12px', color: TEXT_MUTED, mt: 0.25 }}>{name}</Typography>
        </Box>
        <IconButton size="small" onClick={handleClose} aria-label="Close">
          <X size={16} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2, overflowY: 'auto' }}>
        {error && (
          <Typography sx={{ fontSize: '12px', color: DANGER, mb: 1.5 }}>{error}</Typography>
        )}

        {/* Roster */}
        <FieldLabel>{`In this bucket (${bucket.activeChildrenCount}/${MAX_CAPACITY})`}</FieldLabel>
        {loading ? (
          <Box sx={{ mb: 3 }}><RowSkeletons count={Math.max(bucket.activeChildrenCount, 1)} /></Box>
        ) : (
          <>
            {roster.length === 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5, mb: 2 }}>
                <Users size={14} color={TEXT_MUTED} />
                <Typography sx={{ fontSize: '13px', color: TEXT_MUTED }}>No children yet.</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
              {roster.map((c) => (
                <Box
                  key={c.childId}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 1.5,
                    py: 1,
                    border: `1px solid ${BORDER}`,
                    borderRadius: '8px',
                  }}
                >
                  <Typography sx={{ fontSize: '13px', color: TEXT_STRONG }}>
                    {c.firstName} {c.lastName}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => handleRemove(c)}
                    disabled={pendingId === c.childId}
                    aria-label="Remove child"
                    sx={{ color: DANGER }}
                  >
                    {pendingId === c.childId ? <CircularProgress size={14} /> : <Minus size={14} />}
                  </IconButton>
                </Box>
              ))}
            </Box>
          </>
        )}

        {/* Available children */}
        <FieldLabel>Add a child</FieldLabel>
        <Typography sx={{ fontSize: '11px', fontWeight: 600, color: TEXT_MUTED, mb: 0.5 }}>
          Search children
        </Typography>
        <TextField
          inputRef={searchRef}
          size="small"
          fullWidth
          placeholder="Type a name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <Search size={14} style={{ marginRight: 6, color: TEXT_MUTED }} /> }}
          sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { fontSize: '13px' } }}
        />
        {loading ? (
          <RowSkeletons count={3} />
        ) : (
          <>
            {filteredAvailable.length === 0 && (
              <Typography sx={{ fontSize: '13px', color: TEXT_MUTED }}>No children available.</Typography>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {filteredAvailable.map((c) => (
                <Box
                  key={c.childId}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 1.5,
                    py: 1,
                    border: `1px solid ${BORDER}`,
                    borderRadius: '8px',
                  }}
                >
                  <Typography sx={{ fontSize: '13px', color: TEXT_STRONG }}>
                    {c.firstName} {c.lastName}
                  </Typography>
                  <Tooltip title={atCapacity ? `Bucket is full (${MAX_CAPACITY}/${MAX_CAPACITY})` : 'Add to bucket'}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handleAdd(c)}
                        disabled={atCapacity || pendingId === c.childId}
                        aria-label="Add child"
                        sx={{ color: ACCENT }}
                      >
                        {pendingId === c.childId ? <CircularProgress size={14} /> : <Plus size={14} />}
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              ))}
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ManageBucketChildrenModal;
