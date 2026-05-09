'use client';

import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import { X } from 'lucide-react';
import {
  fetchSchoolClasses,
  fetchSections,
  type SchoolClassItem,
  type SectionItem,
} from '@/lib/api/services/structure.service';
import { reactivateChild, type ChildItem } from '@/lib/api/services/children.service';
import toast from 'react-hot-toast';

// ── Design tokens ─────────────────────────────────────────────────────────────

const BORDER = '#E2E8F0';
const MUTED  = '#94A3B8';
const LABEL  = '#374151';
const MAX_CAP = 5;

function capacityColor(count: number): string {
  if (count >= MAX_CAP)     return '#EF4444';
  if (count >= MAX_CAP - 1) return '#F59E0B';
  return '#22C55E';
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: LABEL, mb: 0.75, letterSpacing: '0.01em' }}>
      {children}
    </Typography>
  );
}

// ── ClassPicker ───────────────────────────────────────────────────────────────

function ClassPicker({
  classes,
  value,
  onChange,
}: {
  classes: SchoolClassItem[];
  value: number | undefined;
  onChange: (id: number) => void;
}) {
  if (classes.length === 0) {
    return (
      <Box>
        <FieldLabel>Class</FieldLabel>
        <Box sx={{ p: 2, borderRadius: '8px', border: `1px dashed ${BORDER}`, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '12px', color: MUTED }}>No classes added to this school yet.</Typography>
        </Box>
      </Box>
    );
  }
  return (
    <Box>
      <FieldLabel>Class</FieldLabel>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {classes.map((c) => {
          const selected = value === c.schoolClassId;
          return (
            <Box
              key={c.schoolClassId}
              onClick={() => onChange(c.schoolClassId)}
              sx={{
                px: 2,
                py: 1,
                borderRadius: '8px',
                border: `1.5px solid ${selected ? '#16A34A' : BORDER}`,
                bgcolor: selected ? '#F0FDF4' : '#FAFAFA',
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                '&:hover': { borderColor: '#86EFAC', bgcolor: '#F0FDF4' },
              }}
            >
              <Typography sx={{ fontSize: '13px', fontWeight: selected ? 700 : 500, color: selected ? '#15803D' : '#374151', lineHeight: 1.3 }}>
                {c.className}
              </Typography>
              <Typography sx={{ fontSize: '10px', color: MUTED, lineHeight: 1.3 }}>{c.programName}</Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ── SectionPicker ─────────────────────────────────────────────────────────────

function SectionPicker({
  sections,
  loading,
  value,
  onChange,
}: {
  sections: SectionItem[];
  loading: boolean;
  value: number | undefined;
  onChange: (id: number) => void;
}) {
  return (
    <Box>
      <FieldLabel>Section</FieldLabel>
      {loading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rounded" height={80} sx={{ borderRadius: '8px' }} />
          ))}
        </Box>
      ) : sections.length === 0 ? (
        <Box sx={{ p: 2, borderRadius: '8px', border: `1px dashed ${BORDER}`, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '12px', color: MUTED }}>No sections in this class.</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 1 }}>
          {sections.map((s) => {
            const count    = s.activeChildrenCount;
            const full     = count >= MAX_CAP;
            const pct      = Math.min((count / MAX_CAP) * 100, 100);
            const color    = capacityColor(count);
            const selected = value === s.classSectionId;
            return (
              <Box
                key={s.classSectionId}
                onClick={() => !full && onChange(s.classSectionId)}
                sx={{
                  p: 1.25,
                  borderRadius: '8px',
                  border: `1.5px solid ${selected ? '#16A34A' : full ? '#FECACA' : BORDER}`,
                  bgcolor: selected ? '#F0FDF4' : full ? '#FFF5F5' : '#FAFAFA',
                  cursor: full ? 'not-allowed' : 'pointer',
                  opacity: full ? 0.55 : 1,
                  transition: 'all 0.12s ease',
                  ...(!full && !selected && { '&:hover': { borderColor: '#86EFAC', bgcolor: '#F0FDF4' } }),
                }}
              >
                <Box sx={{ width: 28, height: 28, borderRadius: '6px', bgcolor: selected ? '#16A34A' : `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.75 }}>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: selected ? '#fff' : color }}>
                    {s.sectionCode}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{ height: 4, borderRadius: 2, mb: 0.5, bgcolor: '#E2E8F0', '& .MuiLinearProgress-bar': { bgcolor: selected ? '#16A34A' : color, borderRadius: 2 } }}
                />
                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: selected ? '#15803D' : full ? '#EF4444' : '#374151', lineHeight: 1.4 }}>
                  {full ? 'Full' : `${count}/${MAX_CAP}`}
                </Typography>
                <Typography sx={{ fontSize: '10px', color: MUTED, lineHeight: 1.4 }}>
                  {full ? '0 open' : `${MAX_CAP - count} open`}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ReactivateChildModalProps {
  open: boolean;
  schoolId: number;
  child: ChildItem;
  onClose: () => void;
  onSuccess: () => void;
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function ReactivateChildModal({
  open,
  schoolId,
  child,
  onClose,
  onSuccess,
}: ReactivateChildModalProps) {
  const [classes, setClasses]               = useState<SchoolClassItem[]>([]);
  const [sections, setSections]             = useState<SectionItem[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [selectedClassId, setSelectedClassId]   = useState<number | undefined>();
  const [selectedSectionId, setSelectedSectionId] = useState<number | undefined>();
  const [submitError, setSubmitError]       = useState<string | null>(null);
  const [submitting, setSubmitting]         = useState(false);

  // Load classes on open
  useEffect(() => {
    if (!open) return;
    setClassesLoading(true);
    fetchSchoolClasses(schoolId)
      .then(setClasses)
      .catch(() => toast.error('Could not load classes'))
      .finally(() => setClassesLoading(false));
  }, [open, schoolId]);

  // Load sections when class selected
  useEffect(() => {
    if (!selectedClassId) { setSections([]); return; }
    setSelectedSectionId(undefined);
    setSectionsLoading(true);
    fetchSections(schoolId, selectedClassId)
      .then(setSections)
      .catch(() => toast.error('Could not load sections'))
      .finally(() => setSectionsLoading(false));
  }, [selectedClassId, schoolId]);

  function handleClose() {
    setSelectedClassId(undefined);
    setSelectedSectionId(undefined);
    setSections([]);
    setSubmitError(null);
    onClose();
  }

  async function handleSubmit() {
    if (!selectedSectionId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await reactivateChild(schoolId, child.childId, { class_section_id: selectedSectionId });
      toast.success(`${child.firstName} ${child.lastName} reactivated`);
      handleClose();
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Reactivation failed';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !!selectedSectionId && !submitting;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '14px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
          maxHeight: '90vh',
        },
      }}
    >
      {/* ── Header ── */}
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
            Reactivate child
          </Typography>
          <Typography sx={{ fontSize: '12px', color: MUTED, mt: 0.25 }}>
            {child.firstName} {child.lastName} — select a class and section
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={handleClose}
          sx={{ mt: 0.25, color: MUTED, '&:hover': { bgcolor: '#F1F5F9', color: '#475569' } }}
        >
          <X size={16} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pt: 2.5, pb: 1, overflowY: 'auto' }}>
        {classesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} sx={{ color: '#16A34A' }} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <ClassPicker
              classes={classes}
              value={selectedClassId}
              onChange={setSelectedClassId}
            />
            {selectedClassId && (
              <SectionPicker
                sections={sections}
                loading={sectionsLoading}
                value={selectedSectionId}
                onChange={setSelectedSectionId}
              />
            )}
            {submitError && (
              <Typography sx={{ fontSize: '12px', color: '#EF4444' }}>
                {submitError}
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${BORDER}`, gap: 1 }}>
        <Button
          onClick={handleClose}
          variant="outlined"
          size="small"
          disabled={submitting}
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
          variant="contained"
          size="small"
          disabled={!canSubmit}
          onClick={handleSubmit}
          sx={{
            fontSize: '13px',
            fontWeight: 600,
            minWidth: 96,
            bgcolor: '#16A34A',
            boxShadow: 'none',
            '&:hover': { bgcolor: '#15803D', boxShadow: 'none' },
            '&.Mui-disabled': { bgcolor: '#BBF7D0', color: '#fff' },
          }}
        >
          {submitting ? <CircularProgress size={14} color="inherit" /> : 'Reactivate'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ReactivateChildModal;
