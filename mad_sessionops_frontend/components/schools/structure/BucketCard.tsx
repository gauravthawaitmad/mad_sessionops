'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import { MoreVertical, Users } from 'lucide-react';
import { removeBucket, type BucketItem } from '@/lib/api/services/buckets.service';
import type { ChildItem } from '@/lib/api/services/children.service';
import { showApiError } from '@/lib/toast/toast';
import { EditBucketModal } from './EditBucketModal';
import { ManageBucketChildrenModal } from './ManageBucketChildrenModal';

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_CAPACITY = 5;

const CARD_BORDER  = '#E2E8F0';
const TEXT_MUTED   = '#94A3B8';
const TEXT_STRONG  = '#0F172A';
const ACCENT       = '#2563EB';
const DANGER       = '#EF4444';
const SUCCESS      = '#16A34A';
const WARNING      = '#D97706';

function capacityColor(count: number): string {
  if (count >= MAX_CAPACITY) return DANGER;
  if (count >= MAX_CAPACITY - 1) return WARNING;
  return SUCCESS;
}

function initials(child: ChildItem): string {
  return `${child.firstName[0] ?? ''}${child.lastName[0] ?? ''}`.toUpperCase();
}

// ── AvatarStack ───────────────────────────────────────────────────────────────
// Glanceable roster preview — no click required to see who's in the bucket.

function AvatarStack({ roster, loading }: { roster: ChildItem[]; loading?: boolean }) {
  const MAX_SHOWN = 3;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', mt: 1 }}>
        {[0, 1].map((i) => (
          <Box
            key={i}
            sx={{
              width: 22, height: 22, borderRadius: '50%', bgcolor: '#F1F5F9',
              border: '2px solid #fff', ml: i === 0 ? 0 : -0.75,
            }}
          />
        ))}
      </Box>
    );
  }

  if (roster.length === 0) return null;

  const shown = roster.slice(0, MAX_SHOWN);
  const extra = roster.length - shown.length;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }} onClick={(e) => e.stopPropagation()}>
      {shown.map((c, i) => (
        <Tooltip key={c.childId} title={`${c.firstName} ${c.lastName}`}>
          <Box
            sx={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              bgcolor: '#E0F2FE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '9px',
              fontWeight: 700,
              color: '#0284C7',
              border: '2px solid #fff',
              ml: i === 0 ? 0 : -0.75,
              zIndex: shown.length - i,
              cursor: 'default',
            }}
          >
            {initials(c)}
          </Box>
        </Tooltip>
      ))}
      {extra > 0 && (
        <Box
          sx={{
            width: 22, height: 22, borderRadius: '50%', bgcolor: '#F1F5F9',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '9px', fontWeight: 700, color: '#64748B',
            border: '2px solid #fff', ml: -0.75,
          }}
        >
          +{extra}
        </Box>
      )}
    </Box>
  );
}

// ── Remove confirmation ──────────────────────────────────────────────────────

function RemoveBucketDialog({
  open,
  bucketName,
  onCancel,
  onConfirm,
  confirming,
}: {
  open: boolean;
  bucketName: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: '15px', fontWeight: 700 }}>Remove Bucket</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: '14px', color: '#475569' }}>
          Remove <strong>{bucketName}</strong> from this school? This cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={confirming} size="small">Cancel</Button>
        <Button
          variant="contained"
          color="error"
          size="small"
          onClick={onConfirm}
          disabled={confirming}
          startIcon={confirming ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          Remove
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Bucket card ────────────────────────────────────────────────────────────────

interface BucketCardProps {
  bucket: BucketItem;
  schoolId: number;
  canModify?: boolean;
  roster?: ChildItem[];
  rosterLoading?: boolean;
  onUpdated: (updated: BucketItem) => void;
  onRemoved: (classSectionId: number) => void;
  onRosterChange?: () => void;
}

export function BucketCard({
  bucket,
  schoolId,
  canModify = true,
  roster = [],
  rosterLoading,
  onUpdated,
  onRemoved,
  onRosterChange,
}: BucketCardProps) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const count = bucket.activeChildrenCount;
  const color = capacityColor(count);
  const pct = Math.min((count / MAX_CAPACITY) * 100, 100);
  const isFull = count >= MAX_CAPACITY;
  const name = bucket.sectionDisplayName ?? bucket.sectionName;
  const isEmpty = count === 0;

  async function handleRemoveConfirm() {
    setRemoving(true);
    try {
      await removeBucket(schoolId, bucket.classSectionId);
      onRemoved(bucket.classSectionId);
    } catch (err) {
      showApiError(err);
    } finally {
      setRemoving(false);
      setRemoveOpen(false);
    }
  }

  return (
    <>
      <Box
        role={canModify ? 'button' : undefined}
        tabIndex={canModify ? 0 : undefined}
        aria-label={canModify ? `View ${name}` : undefined}
        onClick={() => canModify && setManageOpen(true)}
        onKeyDown={(e) => {
          if (!canModify) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setManageOpen(true); }
        }}
        sx={{
          position: 'relative',
          p: 2,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: '10px',
          bgcolor: '#fff',
          minWidth: 0,
          cursor: canModify ? 'pointer' : 'default',
          transition: 'all 0.12s ease',
          ...(canModify && {
            '&:hover': { borderColor: '#93C5FD', bgcolor: '#F8FBFF' },
            '&:focus-visible': { outline: `2px solid ${ACCENT}`, outlineOffset: 2 },
          }),
        }}
      >
        {canModify && (
          <IconButton
            size="small"
            aria-label="Bucket options"
            onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}
            sx={{ position: 'absolute', top: 8, right: 8, p: 0.5 }}
          >
            <MoreVertical size={15} strokeWidth={2} color={TEXT_MUTED} />
          </IconButton>
        )}

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem
            onClick={() => { setMenuAnchor(null); setManageOpen(true); }}
            sx={{ fontSize: '13px' }}
          >
            Manage Children
          </MenuItem>
          <MenuItem
            onClick={() => { setMenuAnchor(null); setEditOpen(true); }}
            sx={{ fontSize: '13px' }}
          >
            Edit
          </MenuItem>
          <Tooltip title={isEmpty ? '' : `Remove all ${count} children first`} placement="left">
            <span>
              <MenuItem
                onClick={() => { setMenuAnchor(null); setRemoveOpen(true); }}
                disabled={!isEmpty}
                sx={{ fontSize: '13px', color: DANGER }}
              >
                Delete
              </MenuItem>
            </span>
          </Tooltip>
        </Menu>

        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '9px',
            bgcolor: '#EFF6FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 1.25,
          }}
        >
          <Users size={18} strokeWidth={1.75} color={ACCENT} />
        </Box>

        <Typography sx={{ fontSize: '14px', fontWeight: 700, color: TEXT_STRONG, mb: 1, pr: 3 }}>
          {name}
        </Typography>

        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 5,
            borderRadius: 3,
            bgcolor: '#F1F5F9',
            mb: 0.5,
            '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
          }}
        />

        <Typography sx={{ fontSize: '11px', color, fontWeight: 500 }}>
          {isFull ? `Full · ${MAX_CAPACITY}/${MAX_CAPACITY}` : `${count}/${MAX_CAPACITY} children`}
        </Typography>

        <AvatarStack roster={roster} loading={rosterLoading} />
      </Box>

      <EditBucketModal
        open={editOpen}
        schoolId={schoolId}
        bucket={bucket}
        onClose={() => setEditOpen(false)}
        onEdited={(updated) => { onUpdated(updated); setEditOpen(false); }}
      />

      <ManageBucketChildrenModal
        open={manageOpen}
        schoolId={schoolId}
        bucket={bucket}
        onClose={() => setManageOpen(false)}
        onChildAdded={() => {
          onUpdated({ ...bucket, activeChildrenCount: bucket.activeChildrenCount + 1 });
          onRosterChange?.();
        }}
        onChildRemoved={() => {
          onUpdated({ ...bucket, activeChildrenCount: Math.max(0, bucket.activeChildrenCount - 1) });
          onRosterChange?.();
        }}
      />

      <RemoveBucketDialog
        open={removeOpen}
        bucketName={name}
        onCancel={() => setRemoveOpen(false)}
        onConfirm={handleRemoveConfirm}
        confirming={removing}
      />
    </>
  );
}

export default BucketCard;
