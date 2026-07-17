'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Tooltip from '@mui/material/Tooltip';
import { Plus, Layers, BookOpen, X } from 'lucide-react';
import { fetchBuckets, type BucketItem } from '@/lib/api/services/buckets.service';
import {
  fetchSchoolClasses,
  removeSchoolClass,
  type SchoolClassItem,
} from '@/lib/api/services/structure.service';
import { fetchChildren, type ChildItem } from '@/lib/api/services/children.service';
import { showApiError } from '@/lib/toast/toast';
import { BucketCard } from './BucketCard';
import { AddBucketModal } from './AddBucketModal';
import { AddClassModal } from './AddClassModal';

// ── Constants ──────────────────────────────────────────────────────────────────

const TEXT_MUTED   = '#94A3B8';
const TEXT_STRONG  = '#0F172A';
const CARD_BORDER  = '#E2E8F0';
const DANGER       = '#EF4444';
const CLASS_ACCENT = '#7C3AED';

// ── Section header (shared visual weight for Classes + Buckets) ────────────────

function SectionHeader({
  title,
  actionLabel,
  onAction,
  disabled,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
      <Typography sx={{ fontSize: '18px', fontWeight: 700, color: TEXT_STRONG }}>
        {title}
      </Typography>
      {actionLabel && onAction && (
        <Button
          variant="contained"
          size="small"
          startIcon={<Plus size={14} />}
          onClick={onAction}
          disabled={disabled}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}

// ── Class card ────────────────────────────────────────────────────────────────

function ClassCard({
  schoolClass,
  canModify,
  onRemove,
}: {
  schoolClass: SchoolClassItem;
  canModify: boolean;
  onRemove: () => void;
}) {
  return (
    <Box
      sx={{
        position: 'relative',
        p: 2,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: '10px',
        bgcolor: '#fff',
        minWidth: 0,
        transition: 'all 0.12s ease',
        '&:hover': { borderColor: '#C4B5FD', bgcolor: '#FAF8FF' },
      }}
    >
      {canModify && (
        <Tooltip title="Remove class">
          <IconButton
            size="small"
            aria-label={`Remove ${schoolClass.className}`}
            onClick={onRemove}
            sx={{
              position: 'absolute', top: 8, right: 8, p: 0.5, color: TEXT_MUTED,
              '&:hover': { color: DANGER, bgcolor: '#FEF2F2' },
            }}
          >
            <X size={14} />
          </IconButton>
        </Tooltip>
      )}

      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '9px',
          bgcolor: '#F5F3FF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 1.25,
        }}
      >
        <BookOpen size={18} strokeWidth={1.75} color={CLASS_ACCENT} />
      </Box>

      <Typography sx={{ fontSize: '14px', fontWeight: 700, color: TEXT_STRONG, mb: 0.25, pr: 3 }}>
        {schoolClass.className}
      </Typography>
      <Typography sx={{ fontSize: '11px', color: TEXT_MUTED }}>
        {schoolClass.programName}
      </Typography>
    </Box>
  );
}

// ── Empty states ──────────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Box sx={{ mt: 2, mb: 2, py: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, border: `1px dashed ${CARD_BORDER}`, borderRadius: '10px', bgcolor: '#FAFAFA' }}>
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: '12px',
          bgcolor: '#F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 0.5,
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontSize: '15px', fontWeight: 600, color: TEXT_STRONG }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: '13px', color: TEXT_MUTED, textAlign: 'center', maxWidth: 300 }}>
        {subtitle}
      </Typography>
    </Box>
  );
}

// ── Remove class confirmation ────────────────────────────────────────────────

function RemoveClassDialog({
  open,
  className,
  onCancel,
  onConfirm,
  confirming,
}: {
  open: boolean;
  className: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: '15px', fontWeight: 700 }}>Remove Class</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: '14px', color: '#475569' }}>
          Remove <strong>{className}</strong> from this school?
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

// ── Main component ─────────────────────────────────────────────────────────────

interface BucketsTabProps {
  schoolId: number;
  canModify?: boolean;
}

export function BucketsTab({ schoolId, canModify = true }: BucketsTabProps) {
  const [classes, setClasses] = useState<SchoolClassItem[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [addClassOpen, setAddClassOpen] = useState(false);
  const [removeClassTarget, setRemoveClassTarget] = useState<SchoolClassItem | null>(null);
  const [removingClass, setRemovingClass] = useState(false);

  const [buckets, setBuckets] = useState<BucketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addBucketOpen, setAddBucketOpen] = useState(false);

  // All active children, fetched once and grouped by bucket — powers each
  // BucketCard's avatar-stack preview without a per-card fetch.
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setClassesLoading(true);
    fetchSchoolClasses(schoolId)
      .then((data) => { if (!cancelled) setClasses(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setClassesLoading(false); });
    return () => { cancelled = true; };
  }, [schoolId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchBuckets(schoolId)
      .then((data) => { if (!cancelled) { setBuckets(data); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError('Failed to load buckets.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [schoolId]);

  const loadChildren = useCallback(() => {
    setChildrenLoading(true);
    fetchChildren(schoolId, { status: 'active' })
      .then(setChildren)
      .catch(() => {})
      .finally(() => setChildrenLoading(false));
  }, [schoolId]);

  useEffect(() => { loadChildren(); }, [loadChildren]);

  const childrenByBucket = useMemo(() => {
    const map = new Map<number, ChildItem[]>();
    for (const c of children) {
      const bucketId = c.currentSection?.classSectionId;
      if (bucketId == null) continue;
      if (!map.has(bucketId)) map.set(bucketId, []);
      map.get(bucketId)!.push(c);
    }
    return map;
  }, [children]);

  async function handleRemoveClassConfirm() {
    if (!removeClassTarget) return;
    setRemovingClass(true);
    try {
      await removeSchoolClass(schoolId, removeClassTarget.schoolClassId);
      setClasses((prev) => prev.filter((c) => c.schoolClassId !== removeClassTarget.schoolClassId));
      setRemoveClassTarget(null);
    } catch (err) {
      setRemoveClassTarget(null);
      showApiError(err);
    } finally {
      setRemovingClass(false);
    }
  }

  const existingClassIds = classes.map((c) => c.gradeClassId);

  return (
    <Box sx={{ px: 4, pt: 3, pb: 6 }}>
      {/* Classes */}
      <Box sx={{ mb: 4 }}>
        <SectionHeader
          title="Classes"
          actionLabel="Add Class"
          onAction={canModify ? () => setAddClassOpen(true) : undefined}
          disabled={classesLoading}
        />

        {classesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : classes.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={22} strokeWidth={1.5} color={TEXT_MUTED} />}
            title="No classes added yet."
            subtitle="Add a class to start enrolling children into this school."
          />
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
            {classes.map((c) => (
              <ClassCard
                key={c.schoolClassId}
                schoolClass={c}
                canModify={canModify}
                onRemove={() => setRemoveClassTarget(c)}
              />
            ))}
          </Box>
        )}
      </Box>

      <Divider sx={{ mb: 4, borderColor: CARD_BORDER }} />

      {/* Buckets */}
      <Box>
        <SectionHeader
          title="Buckets"
          actionLabel="Add Bucket"
          onAction={canModify ? () => setAddBucketOpen(true) : undefined}
          disabled={loading}
        />

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {!loading && error && (
          <Typography sx={{ color: DANGER, fontSize: '14px', textAlign: 'center', mt: 8 }}>
            {error}
          </Typography>
        )}

        {!loading && !error && buckets.length === 0 && (
          <EmptyState
            icon={<Layers size={22} strokeWidth={1.5} color={TEXT_MUTED} />}
            title="No buckets added yet."
            subtitle="Add a bucket to start grouping children for this school."
          />
        )}

        {!loading && !error && buckets.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
            {buckets.map((b) => (
              <BucketCard
                key={b.classSectionId}
                bucket={b}
                schoolId={schoolId}
                canModify={canModify}
                roster={childrenByBucket.get(b.classSectionId) ?? []}
                rosterLoading={childrenLoading}
                onUpdated={(updated) =>
                  setBuckets((prev) => prev.map((x) => (x.classSectionId === updated.classSectionId ? updated : x)))
                }
                onRemoved={(id) => setBuckets((prev) => prev.filter((x) => x.classSectionId !== id))}
                onRosterChange={loadChildren}
              />
            ))}
          </Box>
        )}
      </Box>

      <AddClassModal
        open={addClassOpen}
        schoolId={schoolId}
        existingClassIds={existingClassIds}
        onClose={() => setAddClassOpen(false)}
        onAdded={(sc) => setClasses((prev) => [...prev, sc])}
      />

      <RemoveClassDialog
        open={Boolean(removeClassTarget)}
        className={removeClassTarget?.className ?? ''}
        onCancel={() => setRemoveClassTarget(null)}
        onConfirm={handleRemoveClassConfirm}
        confirming={removingClass}
      />

      <AddBucketModal
        open={addBucketOpen}
        schoolId={schoolId}
        onClose={() => setAddBucketOpen(false)}
        onAdded={(bucket) => setBuckets((prev) => [...prev, bucket])}
      />
    </Box>
  );
}

export default BucketsTab;
