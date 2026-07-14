'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import { Plus, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchBuckets, type BucketItem } from '@/lib/api/services/buckets.service';
import {
  fetchSlotClasses,
  type SlotClassItem,
} from '@/lib/api/services/slot_classes.service';
import type { SlotItem, DayOfWeek } from '@/lib/api/services/slots.service';
import { AddSlotClassModal, type PrefillBucket } from './AddSlotClassModal';
import { DeleteSlotClassModal } from './DeleteSlotClassModal';
import { formatTime } from './SlotCard';

// ── Design tokens ─────────────────────────────────────────────────────────────

const BORDER = '#E2E8F0';
const MUTED  = '#94A3B8';
const MAX_CAP = 5;

const DAY_COLOR: Record<DayOfWeek, { bg: string; text: string; border: string }> = {
  monday:    { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  tuesday:   { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  wednesday: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  thursday:  { bg: '#FDF4FF', text: '#7E22CE', border: '#E9D5FF' },
  friday:    { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  saturday:  { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
  sunday:    { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
};

const DAY_SHORT: Record<DayOfWeek, string> = {
  monday: 'MON', tuesday: 'TUE', wednesday: 'WED',
  thursday: 'THU', friday: 'FRI', saturday: 'SAT', sunday: 'SUN',
};

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}

function capColor(count: number): string {
  if (count >= MAX_CAP)     return '#EF4444';
  if (count >= MAX_CAP - 1) return '#F59E0B';
  return '#22C55E';
}

// ── Types ──────────────────────────────────────────────────────────────────────

// slotId → list of slot-class assignments for that slot
type BySlot = Map<number, SlotClassItem[]>;

// classSectionId (bucket) → slotId → assignment (for O(1) cell lookup)
type ByBucket = Map<number, Map<number, SlotClassItem>>;

function buildByBucket(bySlot: BySlot): ByBucket {
  const map: ByBucket = new Map();
  for (const [slotId, classes] of bySlot) {
    for (const scs of classes) {
      if (!map.has(scs.classSectionId)) map.set(scs.classSectionId, new Map());
      map.get(scs.classSectionId)!.set(slotId, scs);
    }
  }
  return map;
}

// ── AssignedCell ──────────────────────────────────────────────────────────────

const VOL_COLORS = ['#0284C7', '#7C3AED'] as const;

function AssignedCell({
  scs,
  canModify,
  onDelete,
}: {
  scs: SlotClassItem;
  canModify: boolean;
  onDelete: () => void;
}) {
  return (
    <Box
      sx={{
        height: '100%',
        p: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.625,
        bgcolor: '#F0F9FF',
        border: '1.5px solid #BAE6FD',
        borderRadius: '8px',
        transition: 'all 0.15s ease',
        '&:hover': { borderColor: '#38BDF8', bgcolor: '#E0F2FE' },
      }}
    >
      {/* Row 1: delete (only rendered when there's something to show) */}
      {canModify && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            sx={{
              p: 0.25,
              flexShrink: 0,
              color: MUTED,
              '&:hover': { color: '#EF4444', bgcolor: '#FEF2F2' },
            }}
          >
            <Trash2 size={11} />
          </IconButton>
        </Box>
      )}

      {/* Volunteer rows — show first name only to keep cells compact */}
      {scs.volunteers.length === 0 ? (
        <Typography sx={{ fontSize: '9px', color: MUTED, fontStyle: 'italic', lineHeight: 1.3 }}>
          No volunteers
        </Typography>
      ) : (
        scs.volunteers.map((v, i) => (
          <Tooltip key={v.userId} title={v.userDisplayName} placement="top" arrow>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  bgcolor: VOL_COLORS[i % VOL_COLORS.length],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '6px',
                  fontWeight: 800,
                  color: '#fff',
                  flexShrink: 0,
                  userSelect: 'none',
                }}
              >
                {initials(v.userDisplayName)}
              </Box>
              <Typography
                sx={{
                  fontSize: '10px',
                  color: '#334155',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.3,
                }}
              >
                {firstName(v.userDisplayName)}
              </Typography>
            </Box>
          </Tooltip>
        ))
      )}
    </Box>
  );
}

// ── EmptyCell ─────────────────────────────────────────────────────────────────

function EmptyCell({ canModify, onClick }: { canModify: boolean; onClick: () => void }) {
  if (!canModify) {
    return (
      <Box
        sx={{
          height: '100%',
          minHeight: 80,
          borderRadius: '8px',
          border: `1.5px dashed ${BORDER}`,
          bgcolor: '#FAFAFA',
        }}
      />
    );
  }

  return (
    <Box
      onClick={onClick}
      sx={{
        height: '100%',
        minHeight: 80,
        borderRadius: '8px',
        border: `1.5px dashed ${BORDER}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        '& .ph-icon': { opacity: 0.2, transition: 'opacity 0.15s ease, color 0.15s ease', color: MUTED },
        '&:hover': {
          borderColor: '#93C5FD',
          bgcolor: '#F0F9FF',
          '& .ph-icon': { opacity: 1, color: '#3B82F6' },
        },
      }}
    >
      <Box className="ph-icon">
        <Plus size={15} />
      </Box>
    </Box>
  );
}

// ── SlotColHeader ─────────────────────────────────────────────────────────────

function SlotColHeader({
  slot,
  canModify,
  onEdit,
  onDelete,
}: {
  slot: SlotItem;
  canModify: boolean;
  onEdit: (s: SlotItem) => void;
  onDelete: (s: SlotItem) => void;
}) {
  const color = DAY_COLOR[slot.dayOfWeek];

  return (
    <Box
      sx={{
        px: 1.5,
        py: 1.25,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        bgcolor: '#FAFBFF',
        borderBottom: `1.5px solid ${BORDER}`,
        borderLeft: `1px solid ${BORDER}`,
        minHeight: 68,
        position: 'relative',
      }}
    >
      <Box
        sx={{
          px: 0.875,
          py: 0.25,
          borderRadius: '6px',
          bgcolor: color.bg,
          border: `1.5px solid ${color.border}`,
          alignSelf: 'flex-start',
        }}
      >
        <Typography sx={{ fontSize: '9px', fontWeight: 800, color: color.text, letterSpacing: '0.06em' }}>
          {DAY_SHORT[slot.dayOfWeek]}
        </Typography>
      </Box>

      <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#1E293B', lineHeight: 1.3 }}>
        {formatTime(slot.startTime)}
        <Typography component="span" sx={{ color: MUTED, fontWeight: 400 }}> – </Typography>
        {formatTime(slot.endTime)}
      </Typography>

      <Typography
        sx={{
          fontSize: '10px',
          color: MUTED,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          pr: canModify ? 3.5 : 0,
        }}
      >
        {slot.slotName}
      </Typography>

      {/* Edit / Delete — always visible */}
      {canModify && (
        <Box
          sx={{
            position: 'absolute',
            top: 6,
            right: 6,
            display: 'flex',
            gap: 0.25,
          }}
        >
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onEdit(slot); }}
            sx={{
              p: 0.375,
              color: MUTED,
              '&:hover': { color: '#2563EB', bgcolor: '#EFF6FF' },
            }}
          >
            <Pencil size={11} />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onDelete(slot); }}
            sx={{
              p: 0.375,
              color: MUTED,
              '&:hover': { color: '#EF4444', bgcolor: '#FEF2F2' },
            }}
          >
            <Trash2 size={11} />
          </IconButton>
        </Box>
      )}
    </Box>
  );
}

// ── BucketRowHeader ───────────────────────────────────────────────────────────
// Buckets are class-agnostic (M6 decision #1) — flat rows, no class grouping.

function BucketRowHeader({ bucket }: { bucket: BucketItem }) {
  const count = bucket.activeChildrenCount;
  const color = capColor(count);
  const name  = bucket.sectionDisplayName ?? bucket.sectionName;

  return (
    <Box
      sx={{
        px: 2,
        py: 1.25,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.375,
        borderRight: `1.5px solid ${BORDER}`,
        borderBottom: `1px solid ${BORDER}`,
        bgcolor: '#fff',
        position: 'sticky',
        left: 0,
        zIndex: 1,
        minHeight: 80,
        justifyContent: 'center',
      }}
    >
      <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', lineHeight: 1.3 }}>
        {name}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <LinearProgress
          variant="determinate"
          value={Math.min((count / MAX_CAP) * 100, 100)}
          sx={{
            width: 36,
            height: 3,
            borderRadius: 2,
            bgcolor: '#E2E8F0',
            flexShrink: 0,
            '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 2 },
          }}
        />
        <Typography sx={{ fontSize: '9px', color: MUTED, lineHeight: 1 }}>
          {count}/{MAX_CAP}
        </Typography>
      </Box>
    </Box>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface SlotGridViewProps {
  schoolId: number;
  slots: SlotItem[];
  canModify: boolean;
  onCountChange: (slotId: number, delta: number) => void;
  onEditSlot: (slot: SlotItem) => void;
  onDeleteSlot: (slot: SlotItem) => void;
}

// ── SlotGridView ──────────────────────────────────────────────────────────────

export function SlotGridView({
  schoolId,
  slots,
  canModify,
  onCountChange,
  onEditSlot,
  onDeleteSlot,
}: SlotGridViewProps) {
  const [buckets,       setBuckets]       = useState<BucketItem[]>([]);
  const [bySlot,        setBySlot]        = useState<BySlot>(new Map());
  const [loading,       setLoading]       = useState(true);
  const [addModal,      setAddModal]      = useState<{ slot: SlotItem; bucket: PrefillBucket } | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<{ slot: SlotItem; scs: SlotClassItem } | null>(null);

  // Use a stable string key (sorted slot IDs) so `loadAll` only re-runs
  // when the SET of slots actually changes — not on every parent re-render.
  const slotIdsKey = useMemo(
    () => slots.map((s) => s.slotId).sort().join(','),
    [slots],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // Buckets are flat and class-agnostic (M6 decision #1) — fetch once, no per-class hydration.
      const [bucketList, allSlotClasses] = await Promise.all([
        fetchBuckets(schoolId),
        Promise.all(slots.map((s) => fetchSlotClasses(schoolId, s.slotId))),
      ]);

      setBuckets(bucketList);

      const map: BySlot = new Map();
      slots.forEach((slot, i) => {
        map.set(slot.slotId, allSlotClasses[i]);
      });
      setBySlot(map);
    } catch {
      toast.error('Failed to load schedule grid.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, slotIdsKey]); // stable key — avoids re-fetching on count-only changes

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Slot-class: add ──────────────────────────────────────────────────────────

  function handleAdded(slot: SlotItem, scs: SlotClassItem) {
    setBySlot((prev) => {
      const next = new Map(prev);
      next.set(slot.slotId, [...(next.get(slot.slotId) ?? []), scs]);
      return next;
    });
    onCountChange(slot.slotId, +1);
    toast.success('Class assigned.');
  }

  // ── Slot-class: delete (opens confirmation modal) ────────────────────────────

  function handleOpenDelete(slot: SlotItem, scs: SlotClassItem) {
    setDeleteTarget({ slot, scs });
  }

  function handleSlotClassDeleted(scsId: number) {
    if (!deleteTarget) return;
    setBySlot((prev) => {
      const next = new Map(prev);
      next.set(
        deleteTarget.slot.slotId,
        (next.get(deleteTarget.slot.slotId) ?? []).filter(
          (s) => s.slotClassSectionId !== scsId,
        ),
      );
      return next;
    });
    onCountChange(deleteTarget.slot.slotId, -1);
    toast.success('Assignment removed.');
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const byBucket = buildByBucket(bySlot);
  const totalBuckets = buckets.length;
  const colTemplate = `180px repeat(${Math.max(slots.length, 1)}, minmax(150px, 1fr))`;

  return (
    <>
      <Box
        sx={{
          overflowX: 'auto',
          border: `1.5px solid ${BORDER}`,
          borderRadius: '12px',
          bgcolor: '#fff',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: colTemplate,
            minWidth: slots.length > 0 ? `${180 + slots.length * 150}px` : '100%',
          }}
        >
          {/* ── Header row ─────────────────────────────────────────────── */}

          {/* Top-left corner cell */}
          <Box
            sx={{
              px: 2,
              py: 1.25,
              bgcolor: '#F8FAFC',
              borderBottom: `1.5px solid ${BORDER}`,
              borderRight: `1.5px solid ${BORDER}`,
              position: 'sticky',
              left: 0,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Typography
              sx={{
                fontSize: '11px',
                fontWeight: 700,
                color: MUTED,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Bucket
            </Typography>
          </Box>

          {/* Slot column headers — or empty hint if no slots yet */}
          {slots.length > 0 ? (
            slots.map((slot) => (
              <SlotColHeader
                key={slot.slotId}
                slot={slot}
                canModify={canModify}
                onEdit={onEditSlot}
                onDelete={onDeleteSlot}
              />
            ))
          ) : (
            <Box
              sx={{
                px: 3,
                py: 1.25,
                bgcolor: '#F8FAFC',
                borderBottom: `1.5px solid ${BORDER}`,
                borderLeft: `1px solid ${BORDER}`,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Typography sx={{ fontSize: '12px', color: MUTED, fontStyle: 'italic' }}>
                Add a slot to see columns here
              </Typography>
            </Box>
          )}

          {/* ── Bucket rows — flat, no class grouping (M6 decision #1) ─────── */}

          {totalBuckets === 0 ? (
            <Box
              sx={{
                gridColumn: '1 / -1',
                px: 3,
                py: 5,
                textAlign: 'center',
              }}
            >
              <Typography sx={{ fontSize: '13px', color: MUTED }}>
                No buckets configured yet. Add buckets in the Buckets tab first.
              </Typography>
            </Box>
          ) : (
            buckets.map((bucket) => (
              <React.Fragment key={bucket.classSectionId}>
                <BucketRowHeader bucket={bucket} />

                {slots.length > 0 ? (
                  slots.map((slot) => {
                    const scs = byBucket.get(bucket.classSectionId)?.get(slot.slotId);
                    return (
                      <Box
                        key={slot.slotId}
                        sx={{
                          p: 0.875,
                          borderBottom: `1px solid ${BORDER}`,
                          borderLeft: `1px solid ${BORDER}`,
                        }}
                      >
                        {scs ? (
                          <AssignedCell
                            scs={scs}
                            canModify={canModify}
                            onDelete={() => handleOpenDelete(slot, scs)}
                          />
                        ) : (
                          <EmptyCell
                            canModify={canModify}
                            onClick={() =>
                              setAddModal({
                                slot,
                                bucket: {
                                  classSectionId:      bucket.classSectionId,
                                  sectionDisplayName:  bucket.sectionDisplayName,
                                  sectionName:         bucket.sectionName,
                                  activeChildrenCount: bucket.activeChildrenCount,
                                },
                              })
                            }
                          />
                        )}
                      </Box>
                    );
                  })
                ) : (
                  /* No slots yet — single empty cell spanning slot area */
                  <Box
                    sx={{
                      borderBottom: `1px solid ${BORDER}`,
                      borderLeft: `1px solid ${BORDER}`,
                      bgcolor: '#FAFAFA',
                    }}
                  />
                )}
              </React.Fragment>
            ))
          )}
        </Box>
      </Box>

      {/* Add slot-class modal — pre-fills bucket from clicked cell */}
      {addModal && (
        <AddSlotClassModal
          open
          schoolId={schoolId}
          slot={addModal.slot}
          existingSlotClasses={bySlot.get(addModal.slot.slotId) ?? []}
          prefillBucket={addModal.bucket}
          onClose={() => setAddModal(null)}
          onAdded={(scs) => {
            handleAdded(addModal.slot, scs);
            setAddModal(null);
          }}
        />
      )}

      {/* Delete slot-class confirmation modal */}
      <DeleteSlotClassModal
        open={deleteTarget !== null}
        schoolId={schoolId}
        slotId={deleteTarget?.slot.slotId ?? 0}
        slotClass={deleteTarget?.scs ?? null}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleSlotClassDeleted}
      />
    </>
  );
}
