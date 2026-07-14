'use client';

import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import { X, Check, AlertTriangle } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { fetchBuckets, type BucketItem } from '@/lib/api/services/buckets.service';
import { fetchVolunteers, type VolunteerCard } from '@/lib/api/services/volunteers.service';
import { createSlotClass, type SlotClassItem } from '@/lib/api/services/slot_classes.service';
import type { SlotItem } from '@/lib/api/services/slots.service';
import { VolunteerMultiSelect } from './VolunteerMultiSelect';
import toast from 'react-hot-toast';

// ── Design tokens ─────────────────────────────────────────────────────────────

const BORDER  = '#E2E8F0';
const MUTED   = '#94A3B8';
const LABEL   = '#374151';
const MAX_CAP = 5;

function capacityColor(count: number): string {
  if (count >= MAX_CAP)     return '#EF4444';
  if (count >= MAX_CAP - 1) return '#F59E0B';
  return '#22C55E';
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  class_section_id: z.number().min(1, 'Select a bucket'),
  volunteer_ids: z
    .array(z.number().positive())
    .min(1, 'At least 1 volunteer required')
    .max(5, 'Maximum 5 volunteers'),
}).refine((d) => new Set(d.volunteer_ids).size === d.volunteer_ids.length, {
  message: 'Volunteers must be unique',
  path: ['volunteer_ids'],
});

type FormValues = z.infer<typeof schema>;

// ── CompositionPreview ────────────────────────────────────────────────────────

function CompositionPreview({
  bucket,
  volunteers,
}: {
  bucket?: BucketItem;
  volunteers: VolunteerCard[];
}) {
  const bucketName = bucket ? (bucket.sectionDisplayName ?? bucket.sectionName) : undefined;
  const isComplete = !!bucket && volunteers.length > 0;
  const isEmpty    = !bucket && volunteers.length === 0;

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: '10px',
        border: `1.5px solid ${isComplete ? '#BBF7D0' : isEmpty ? BORDER : '#BAE6FD'}`,
        bgcolor: isComplete ? '#F0FDF4' : isEmpty ? '#FAFAFA' : '#F0F9FF',
        transition: 'background 0.2s ease, border-color 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        minHeight: 52,
      }}
    >
      {isEmpty ? (
        <Typography sx={{ fontSize: '12px', color: '#CBD5E1', fontStyle: 'italic' }}>
          Select a bucket and volunteers below — your assignment preview will appear here.
        </Typography>
      ) : (
        <>
          {/* Bucket badge */}
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              bgcolor: bucketName ? '#EFF6FF' : '#F1F5F9',
              border: bucketName ? 'none' : `2px dashed ${BORDER}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {bucketName && (
              <Typography sx={{ fontSize: '13px', fontWeight: 800, color: '#2563EB' }}>
                {bucketName.charAt(0).toUpperCase()}
              </Typography>
            )}
          </Box>

          {/* Bucket name */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: bucketName ? '#1E293B' : '#CBD5E1' }}>
              {bucketName ?? 'Bucket —'}
            </Typography>
          </Box>

          {/* Volunteer chips */}
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '55%' }}>
            {volunteers.map((v) => (
              <Tooltip key={v.userId} title={v.userDisplayName} placement="top" arrow>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.875, py: 0.375, borderRadius: '20px', bgcolor: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                  <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {initials(v.userDisplayName)}
                  </Box>
                  <Typography sx={{ fontSize: '11px', fontWeight: 500, color: '#0369A1', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.userDisplayName}
                  </Typography>
                </Box>
              </Tooltip>
            ))}
          </Box>

          {/* Done checkmark */}
          {isComplete && (
            <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Check size={12} color="#fff" strokeWidth={3} />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

// ── BucketPicker ──────────────────────────────────────────────────────────────
// Class-agnostic: pulls from fetchBuckets(schoolId), no class scoping/cascade.

function BucketPicker({
  buckets,
  loading,
  usedBucketIds,
  value,
  onChange,
  error,
}: {
  buckets: BucketItem[];
  loading: boolean;
  usedBucketIds: Set<number>;
  value: number;
  onChange: (id: number) => void;
  error?: boolean;
}) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (buckets.length === 0) {
    return (
      <Box sx={{ p: 1.5, borderRadius: '8px', border: `1px dashed ${BORDER}`, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '12px', color: MUTED }}>No buckets added to this school yet.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 0.75 }}>
        {buckets.map((b) => {
          const inSlot   = usedBucketIds.has(b.classSectionId);
          const selected = value === b.classSectionId;
          const count    = b.activeChildrenCount;
          const pct      = Math.min((count / MAX_CAP) * 100, 100);
          const color    = capacityColor(count);
          // Only "already in this slot" disables a bucket here — a bucket at
          // 5/5 children is exactly the one you'd most want to schedule
          // volunteers for, so child-capacity must never disable scheduling.
          const disabled = inSlot;
          const name     = b.sectionDisplayName ?? b.sectionName;

          return (
            <Box
              key={b.classSectionId}
              onClick={() => { if (!disabled) onChange(b.classSectionId); }}
              sx={{
                p: 1.1,
                borderRadius: '8px',
                border: `1.5px solid ${selected ? '#2563EB' : inSlot ? '#FCA5A5' : BORDER}`,
                bgcolor: selected ? '#EFF6FF' : inSlot ? '#FFF5F5' : '#FAFAFA',
                cursor: disabled ? 'not-allowed' : 'pointer',
                userSelect: 'none',
                opacity: disabled ? 0.55 : 1,
                transition: 'all 0.12s ease',
                ...(!disabled && !selected && { '&:hover': { borderColor: '#93C5FD', bgcolor: '#F0F9FF' } }),
              }}
            >
              <Typography sx={{ fontSize: '11px', fontWeight: selected ? 700 : 600, color: selected ? '#1D4ED8' : '#374151', mb: 0.625, lineHeight: 1.25, minHeight: '2.5em' }}>
                {name}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{ height: 3, borderRadius: 2, mb: 0.5, bgcolor: '#E2E8F0', '& .MuiLinearProgress-bar': { bgcolor: selected ? '#2563EB' : color, borderRadius: 2 } }}
              />
              {inSlot ? (
                <Typography sx={{ fontSize: '9px', fontWeight: 700, color: '#EF4444', lineHeight: 1.4 }}>In slot</Typography>
              ) : (
                <Typography sx={{ fontSize: '9px', fontWeight: 700, color: selected ? '#1D4ED8' : '#374151', lineHeight: 1.4 }}>
                  {count}/{MAX_CAP} children
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
      {error && (
        <Typography sx={{ fontSize: '11px', color: '#EF4444', mt: 0.5 }}>Select a bucket</Typography>
      )}
    </Box>
  );
}

// ── ColumnLabel ───────────────────────────────────────────────────────────────

function ColumnLabel({ children, required, optional }: { children: React.ReactNode; required?: boolean; optional?: boolean }) {
  return (
    <Typography sx={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.07em', textTransform: 'uppercase', mb: 1 }}>
      {children}
      {required && <Typography component="span" sx={{ color: '#EF4444', ml: 0.25, fontSize: '11px' }}>*</Typography>}
      {optional && <Typography component="span" sx={{ color: MUTED, ml: 0.5, fontSize: '10px', textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>(optional)</Typography>}
    </Typography>
  );
}

// ── PrefillBucket ─────────────────────────────────────────────────────────────

export interface PrefillBucket {
  classSectionId: number;
  sectionDisplayName: string | null;
  sectionName: string;
  activeChildrenCount: number;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AddSlotClassModalProps {
  open: boolean;
  schoolId: number;
  slot: SlotItem;
  existingSlotClasses: SlotClassItem[];
  prefillBucket?: PrefillBucket;
  onClose: () => void;
  onAdded: (scs: SlotClassItem) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AddSlotClassModal({
  open,
  schoolId,
  slot,
  existingSlotClasses,
  prefillBucket,
  onClose,
  onAdded,
}: AddSlotClassModalProps) {
  const [buckets, setBuckets]         = useState<BucketItem[]>([]);
  const [volunteers, setVolunteers]   = useState<VolunteerCard[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const {
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { class_section_id: 0, volunteer_ids: [] },
  });

  const sectionId    = watch('class_section_id');
  const volunteerIds = watch('volunteer_ids');

  const selectedBucket: BucketItem | undefined = prefillBucket
    ? { classSectionId: prefillBucket.classSectionId, sectionDisplayName: prefillBucket.sectionDisplayName, sectionName: prefillBucket.sectionName, activeChildrenCount: prefillBucket.activeChildrenCount }
    : buckets.find((b) => b.classSectionId === sectionId);
  const selectedVolunteers = volunteers.filter((v) => volunteerIds.includes(v.userId));

  const overCapacity = !!selectedBucket && volunteerIds.length > selectedBucket.activeChildrenCount;
  const canSubmit = sectionId > 0 && volunteerIds.length > 0 && !overCapacity;

  useEffect(() => {
    if (!open) return;
    reset({
      class_section_id: prefillBucket?.classSectionId ?? 0,
      volunteer_ids: [],
    });
    setDataLoading(true);
    Promise.all([
      fetchBuckets(schoolId),
      fetchVolunteers(schoolId),
    ])
      .then(([bks, volRes]) => {
        setBuckets(bks);
        setVolunteers(volRes.volunteers);
      })
      .catch(() => toast.error('Failed to load form data.'))
      .finally(() => setDataLoading(false));
  }, [open, schoolId, reset, prefillBucket]);

  const usedBucketIds = new Set(existingSlotClasses.map((s) => s.classSectionId));
  const usedVolIds    = new Set(
    existingSlotClasses.flatMap((s) => s.volunteers.map((v) => v.userId))
  );

  // R2 hard cap (5) is enforced by the picker itself via maxSelectable=MAX_CAP.
  // R-bucket (volunteers <= bucket's active children) is enforced only via the
  // live count + banner below and disabling submit — server-authoritative,
  // this is a UX hint, not a re-implementation (consistent with the project's
  // display-only business-rule pattern).
  const maxAllowed = selectedBucket ? Math.min(selectedBucket.activeChildrenCount, MAX_CAP) : MAX_CAP;

  async function onSubmit(values: FormValues) {
    try {
      const result = await createSlotClass(schoolId, slot.slotId, {
        class_section_id: values.class_section_id,
        volunteer_ids: values.volunteer_ids,
      });
      onAdded(result);
      onClose();
    } catch (e: unknown) {
      const err = e as { message?: string; data?: { error?: { message?: string } } };
      toast.error(err?.data?.error?.message ?? err?.message ?? 'Failed to assign class.');
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.14)',
          maxWidth: '820px',
          maxHeight: '90vh',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          pt: 2.5,
          pb: 1.5,
          px: 3,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <Box>
          <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
            Assign Class to Slot
          </Typography>
          <Typography sx={{ fontSize: '11px', color: MUTED, mt: 0.25 }}>
            {slot.slotName}
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{ mt: 0.25, color: MUTED, '&:hover': { bgcolor: '#F1F5F9', color: '#475569' } }}
        >
          <X size={16} />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogContent sx={{ p: 0, overflowY: 'auto' }}>

          {/* Live composition preview */}
          <Box sx={{ px: 3, pt: 2, pb: 1.5, borderBottom: `1px solid ${BORDER}` }}>
            <CompositionPreview
              bucket={selectedBucket}
              volunteers={selectedVolunteers}
            />
          </Box>

          {dataLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={28} sx={{ color: '#2563EB' }} />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', minHeight: 300 }}>

              {/* ── Left column: Bucket ──────────────────────────────────────── */}
              <Box
                sx={{
                  width: '38%',
                  flexShrink: 0,
                  p: 2.5,
                  bgcolor: '#FAFBFF',
                  borderRight: `1px solid ${BORDER}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2.5,
                }}
              >
                {prefillBucket ? (
                  /* Pre-selected from grid cell — read-only */
                  <Box>
                    <ColumnLabel>Bucket</ColumnLabel>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: '9px',
                        border: '1.5px solid #2563EB',
                        bgcolor: '#EFF6FF',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                      }}
                    >
                      <Box
                        sx={{
                          width: 30,
                          height: 30,
                          borderRadius: '7px',
                          bgcolor: '#2563EB',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Typography sx={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>
                          {(prefillBucket.sectionDisplayName ?? prefillBucket.sectionName).charAt(0).toUpperCase()}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1E40AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {prefillBucket.sectionDisplayName ?? prefillBucket.sectionName}
                        </Typography>
                        <Typography sx={{ fontSize: '11px', color: '#3B82F6' }}>
                          {prefillBucket.activeChildrenCount}/{MAX_CAP} children
                        </Typography>
                      </Box>
                      <Check size={14} color="#2563EB" strokeWidth={2.5} />
                    </Box>
                    <Typography sx={{ fontSize: '11px', color: MUTED, mt: 0.75 }}>
                      Pre-selected from schedule
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    <ColumnLabel required>Bucket</ColumnLabel>
                    <BucketPicker
                      buckets={buckets}
                      loading={false}
                      usedBucketIds={usedBucketIds}
                      value={sectionId}
                      onChange={(id) => setValue('class_section_id', id, { shouldValidate: true })}
                      error={Boolean(errors.class_section_id)}
                    />
                  </Box>
                )}
              </Box>

              {/* ── Right column: Subject + Volunteers ───────────────────────── */}
              <Box
                sx={{
                  flex: 1,
                  p: 2.5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2.5,
                  overflowY: 'auto',
                }}
              >
                {/* Subject — static, no longer user-editable (M6 decision #3) */}
                <Box>
                  <ColumnLabel>Subject</ColumnLabel>
                  <Typography sx={{ fontSize: '13px', fontWeight: 600, color: LABEL }}>
                    Subject: Foundation
                  </Typography>
                </Box>

                {/* Volunteers */}
                <Box>
                  <ColumnLabel required>Volunteers</ColumnLabel>
                  <Controller
                    name="volunteer_ids"
                    control={control}
                    render={({ field }) => (
                      <VolunteerMultiSelect
                        schoolId={schoolId}
                        value={field.value}
                        onChange={field.onChange}
                        maxSelectable={MAX_CAP}
                        busyVolunteerIds={usedVolIds}
                      />
                    )}
                  />
                  {errors.volunteer_ids && (
                    <Typography sx={{ fontSize: '11px', color: '#EF4444', mt: 0.5 }}>
                      {errors.volunteer_ids.message}
                    </Typography>
                  )}

                  {/* Live count */}
                  {selectedBucket && (
                    <Typography sx={{ fontSize: '11px', color: overCapacity ? '#EF4444' : MUTED, mt: 1 }}>
                      {volunteerIds.length} of {MAX_CAP} selected. Bucket has {selectedBucket.activeChildrenCount} children — max {maxAllowed} volunteer{maxAllowed !== 1 ? 's' : ''}.
                    </Typography>
                  )}

                  {/* R-bucket banner */}
                  {overCapacity && selectedBucket && (
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 1,
                        mt: 1.25,
                        px: 1.5,
                        py: 1,
                        borderRadius: '8px',
                        bgcolor: '#FEF2F2',
                        border: '1px solid #FECACA',
                      }}
                    >
                      <AlertTriangle size={14} strokeWidth={1.75} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} />
                      <Typography sx={{ fontSize: '11px', color: '#B91C1C', lineHeight: 1.5 }}>
                        Cannot assign {volunteerIds.length} volunteers — bucket has only {selectedBucket.activeChildrenCount} child(ren). Maximum {selectedBucket.activeChildrenCount} volunteer(s) allowed.
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${BORDER}`, gap: 1 }}>
          <Button
            onClick={onClose}
            variant="outlined"
            size="small"
            disabled={isSubmitting}
            sx={{
              fontSize: '13px',
              fontWeight: 500,
              borderColor: BORDER,
              color: '#64748B',
              '&:hover': { borderColor: '#CBD5E1', bgcolor: '#F8FAFC' },
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            size="small"
            disabled={isSubmitting || dataLoading || !canSubmit}
            sx={{
              fontSize: '13px',
              fontWeight: 600,
              minWidth: 110,
              bgcolor: '#2563EB',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#1D4ED8', boxShadow: 'none' },
              '&.Mui-disabled': { bgcolor: '#BFDBFE', color: '#fff' },
            }}
          >
            {isSubmitting ? <CircularProgress size={14} color="inherit" /> : 'Assign Class →'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
