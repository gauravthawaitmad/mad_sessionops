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
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import { X, Check } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  fetchSchoolClasses,
  fetchSections,
  type SchoolClassItem,
  type SectionItem,
} from '@/lib/api/services/structure.service';
import { fetchVolunteers, type VolunteerCard } from '@/lib/api/services/volunteers.service';
import {
  fetchSubjects,
  createSlotClass,
  type SlotClassItem,
  type SubjectItem,
} from '@/lib/api/services/slot_classes.service';
import type { SlotItem } from '@/lib/api/services/slots.service';
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

function badgeLetter(sectionName: string): string {
  const parts = sectionName.trim().split(/\s+/);
  return (parts[parts.length - 1].charAt(0) ?? 'S').toUpperCase();
}

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z
  .object({
    class_section_id: z.number().min(1, 'Select a section'),
    subject_id:       z.number().min(1, 'Select a subject'),
    volunteer_1_id:   z.number().min(1, 'Select a volunteer'),
    volunteer_2_id:   z.number(),
  })
  .refine(
    (d) => d.volunteer_2_id === 0 || d.volunteer_1_id !== d.volunteer_2_id,
    { message: 'Must differ from Volunteer 1', path: ['volunteer_2_id'] }
  );

type FormValues = {
  class_section_id: number;
  subject_id: number;
  volunteer_1_id: number;
  volunteer_2_id: number;
};

// ── CompositionPreview ────────────────────────────────────────────────────────

function CompositionPreview({
  section,
  subject,
  vol1,
  vol2,
}: {
  section?: SectionItem;
  subject?: SubjectItem;
  vol1?: VolunteerCard;
  vol2?: VolunteerCard;
}) {
  const isComplete = !!section && !!subject && !!vol1;
  const isEmpty    = !section && !subject && !vol1 && !vol2;

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
          Select a section, subject, and volunteer below — your assignment preview will appear here.
        </Typography>
      ) : (
        <>
          {/* Section badge */}
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              bgcolor: section ? '#EFF6FF' : '#F1F5F9',
              border: section ? 'none' : `2px dashed ${BORDER}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {section && (
              <Typography sx={{ fontSize: '13px', fontWeight: 800, color: '#2563EB' }}>
                {badgeLetter(section.sectionName)}
              </Typography>
            )}
          </Box>

          {/* Section + subject */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: section ? '#1E293B' : '#CBD5E1' }}>
                {section ? section.sectionName : 'Section —'}
              </Typography>
              {subject && (
                <Box sx={{ px: 1.25, py: 0.25, borderRadius: '20px', bgcolor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#16A34A' }}>
                    {subject.subjectName}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Volunteer chips */}
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {vol1 && (
              <Tooltip title={vol1.userDisplayName} placement="top" arrow>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.875, py: 0.375, borderRadius: '20px', bgcolor: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                  <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {initials(vol1.userDisplayName)}
                  </Box>
                  <Typography sx={{ fontSize: '11px', fontWeight: 500, color: '#0369A1', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {vol1.userDisplayName}
                  </Typography>
                </Box>
              </Tooltip>
            )}
            {vol2 && (
              <Tooltip title={vol2.userDisplayName} placement="top" arrow>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.875, py: 0.375, borderRadius: '20px', bgcolor: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                  <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {initials(vol2.userDisplayName)}
                  </Box>
                  <Typography sx={{ fontSize: '11px', fontWeight: 500, color: '#0369A1', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {vol2.userDisplayName}
                  </Typography>
                </Box>
              </Tooltip>
            )}
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

// ── ClassPicker ───────────────────────────────────────────────────────────────

function ClassPicker({
  classes,
  value,
  onChange,
  error,
}: {
  classes: SchoolClassItem[];
  value: number | null;
  onChange: (id: number) => void;
  error?: boolean;
}) {
  if (classes.length === 0) {
    return (
      <Box sx={{ p: 1.5, borderRadius: '8px', border: `1px dashed ${BORDER}`, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '12px', color: MUTED }}>No classes added to this school yet.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {classes.map((c) => {
          const selected = value === c.schoolClassId;
          return (
            <Box
              key={c.schoolClassId}
              onClick={() => onChange(c.schoolClassId)}
              sx={{
                px: 1.75,
                py: 1,
                borderRadius: '8px',
                border: `1.5px solid ${selected ? '#2563EB' : BORDER}`,
                bgcolor: selected ? '#EFF6FF' : '#FAFAFA',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'all 0.12s ease',
                '&:hover': { borderColor: selected ? '#2563EB' : '#93C5FD', bgcolor: selected ? '#EFF6FF' : '#F0F9FF' },
              }}
            >
              <Typography sx={{ fontSize: '13px', fontWeight: selected ? 700 : 500, color: selected ? '#1D4ED8' : '#374151', lineHeight: 1.3 }}>
                {c.className}
              </Typography>
            </Box>
          );
        })}
      </Box>
      {error && (
        <Typography sx={{ fontSize: '11px', color: '#EF4444', mt: 0.5 }}>Select a class first</Typography>
      )}
    </Box>
  );
}

// ── SectionPicker ─────────────────────────────────────────────────────────────

function SectionPicker({
  sections,
  loading,
  usedSectionNames,
  value,
  onChange,
  error,
}: {
  sections: SectionItem[];
  loading: boolean;
  usedSectionNames: Set<string>;
  value: number;
  onChange: (id: number) => void;
  error?: boolean;
}) {
  if (loading) {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 0.75 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={70} sx={{ borderRadius: '8px' }} />
        ))}
      </Box>
    );
  }

  if (sections.length === 0) {
    return (
      <Box sx={{ p: 1.5, borderRadius: '8px', border: `1px dashed ${BORDER}`, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '12px', color: MUTED }}>No sections in this class.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 0.75 }}>
        {sections.map((s) => {
          const inSlot   = usedSectionNames.has(s.sectionName);
          const selected = value === s.classSectionId;
          const count    = s.activeChildrenCount;
          const full     = count >= MAX_CAP;
          const pct      = Math.min((count / MAX_CAP) * 100, 100);
          const color    = capacityColor(count);
          const disabled = inSlot || full;

          return (
            <Box
              key={s.classSectionId}
              onClick={() => { if (!disabled) onChange(s.classSectionId); }}
              sx={{
                p: 1.1,
                borderRadius: '8px',
                border: `1.5px solid ${selected ? '#2563EB' : inSlot ? '#FCA5A5' : full ? '#FECACA' : BORDER}`,
                bgcolor: selected ? '#EFF6FF' : inSlot || full ? '#FFF5F5' : '#FAFAFA',
                cursor: disabled ? 'not-allowed' : 'pointer',
                userSelect: 'none',
                opacity: disabled ? 0.55 : 1,
                transition: 'all 0.12s ease',
                ...(!disabled && !selected && { '&:hover': { borderColor: '#93C5FD', bgcolor: '#F0F9FF' } }),
              }}
            >
              {/* Letter */}
              <Box sx={{ width: 26, height: 26, borderRadius: '6px', bgcolor: selected ? '#2563EB' : `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.625 }}>
                <Typography sx={{ fontSize: '11px', fontWeight: 700, color: selected ? '#fff' : color }}>
                  {s.sectionCode}
                </Typography>
              </Box>
              {/* Capacity bar */}
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{ height: 3, borderRadius: 2, mb: 0.5, bgcolor: '#E2E8F0', '& .MuiLinearProgress-bar': { bgcolor: selected ? '#2563EB' : color, borderRadius: 2 } }}
              />
              {inSlot ? (
                <Typography sx={{ fontSize: '9px', fontWeight: 700, color: '#EF4444', lineHeight: 1.4 }}>In slot</Typography>
              ) : (
                <Typography sx={{ fontSize: '9px', fontWeight: 700, color: selected ? '#1D4ED8' : full ? '#EF4444' : '#374151', lineHeight: 1.4 }}>
                  {full ? 'Full' : `${count}/${MAX_CAP}`}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
      {error && (
        <Typography sx={{ fontSize: '11px', color: '#EF4444', mt: 0.5 }}>Select a section</Typography>
      )}
    </Box>
  );
}

// ── SubjectPicker ─────────────────────────────────────────────────────────────

function SubjectPicker({
  subjects,
  value,
  onChange,
  error,
}: {
  subjects: SubjectItem[];
  value: number;
  onChange: (id: number) => void;
  error?: boolean;
}) {
  if (subjects.length === 0) {
    return (
      <Box sx={{ p: 1.5, borderRadius: '8px', border: `1px dashed ${BORDER}`, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '12px', color: MUTED }}>No subjects found. Ask an admin.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {subjects.map((s) => {
          const selected = value === s.subjectId;
          return (
            <Box
              key={s.subjectId}
              onClick={() => onChange(s.subjectId)}
              sx={{
                px: 2,
                py: 0.875,
                borderRadius: '8px',
                border: `1.5px solid ${selected ? '#2563EB' : BORDER}`,
                bgcolor: selected ? '#EFF6FF' : '#FAFAFA',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'all 0.12s ease',
                '&:hover': { borderColor: selected ? '#2563EB' : '#93C5FD', bgcolor: selected ? '#EFF6FF' : '#F0F9FF' },
              }}
            >
              <Typography sx={{ fontSize: '12px', fontWeight: selected ? 700 : 500, color: selected ? '#1D4ED8' : '#374151' }}>
                {s.subjectName}
              </Typography>
            </Box>
          );
        })}
      </Box>
      {error && (
        <Typography sx={{ fontSize: '11px', color: '#EF4444', mt: 0.5 }}>Select a subject</Typography>
      )}
    </Box>
  );
}

// ── CompactVolCard ────────────────────────────────────────────────────────────

function CompactVolCard({
  volunteer,
  selected,
  disabled,
  disabledReason,
  onClick,
}: {
  volunteer: VolunteerCard;
  selected: boolean;
  disabled: boolean;
  disabledReason?: string;
  onClick: () => void;
}) {
  const ini = initials(volunteer.userDisplayName);

  return (
    <Box
      onClick={disabled ? undefined : onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.875,
        px: 1,
        py: 0.875,
        borderRadius: '8px',
        border: `1.5px solid ${selected ? '#2563EB' : BORDER}`,
        bgcolor: selected ? '#EFF6FF' : '#FAFAFA',
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        opacity: disabled ? 0.45 : 1,
        transition: 'all 0.12s ease',
        ...(!disabled && !selected && { '&:hover': { borderColor: '#93C5FD', bgcolor: '#F0F9FF' } }),
      }}
    >
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: selected ? '#2563EB' : '#E0F2FE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: '10px',
          fontWeight: 700,
          color: selected ? '#fff' : '#0284C7',
        }}
      >
        {ini}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '12px',
            fontWeight: selected ? 600 : 400,
            color: selected ? '#1D4ED8' : '#1E293B',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.3,
          }}
        >
          {volunteer.userDisplayName}
        </Typography>
        {disabledReason && (
          <Typography sx={{ fontSize: '10px', color: MUTED, lineHeight: 1.3 }}>
            {disabledReason}
          </Typography>
        )}
      </Box>
      {selected && (
        <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Check size={10} color="#fff" strokeWidth={3} />
        </Box>
      )}
    </Box>
  );
}

// ── NoneCard ──────────────────────────────────────────────────────────────────

function NoneCard({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.875,
        px: 1,
        py: 0.875,
        borderRadius: '8px',
        border: `1.5px solid ${selected ? '#2563EB' : BORDER}`,
        bgcolor: selected ? '#EFF6FF' : '#FAFAFA',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'all 0.12s ease',
        ...(!selected && { '&:hover': { borderColor: '#93C5FD', bgcolor: '#F0F9FF' } }),
      }}
    >
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: selected ? '#2563EB' : '#F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: '14px',
          fontWeight: 700,
          color: selected ? '#fff' : MUTED,
        }}
      >
        —
      </Box>
      <Typography sx={{ fontSize: '12px', fontWeight: selected ? 600 : 400, color: selected ? '#1D4ED8' : '#64748B', flex: 1 }}>
        None
      </Typography>
      {selected && (
        <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Check size={10} color="#fff" strokeWidth={3} />
        </Box>
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

function SubLabel({ children, required, optional }: { children: React.ReactNode; required?: boolean; optional?: boolean }) {
  return (
    <Typography sx={{ fontSize: '11px', fontWeight: 600, color: LABEL, mb: 0.875 }}>
      {children}
      {required && <Typography component="span" sx={{ color: '#EF4444', ml: 0.25, fontSize: '11px' }}>*</Typography>}
      {optional && <Typography component="span" sx={{ fontSize: '10px', color: MUTED, fontWeight: 400, ml: 0.5 }}>(optional)</Typography>}
    </Typography>
  );
}

// ── PrefillSection ────────────────────────────────────────────────────────────

export interface PrefillSection {
  classSectionId: number;
  sectionName: string;
  sectionCode: string;
  activeChildrenCount: number;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AddSlotClassModalProps {
  open: boolean;
  schoolId: number;
  slot: SlotItem;
  existingSlotClasses: SlotClassItem[];
  prefillSection?: PrefillSection;
  onClose: () => void;
  onAdded: (scs: SlotClassItem) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AddSlotClassModal({
  open,
  schoolId,
  slot,
  existingSlotClasses,
  prefillSection,
  onClose,
  onAdded,
}: AddSlotClassModalProps) {
  const [classes,         setClasses]         = useState<SchoolClassItem[]>([]);
  const [subjects,        setSubjects]        = useState<SubjectItem[]>([]);
  const [volunteers,      setVolunteers]      = useState<VolunteerCard[]>([]);
  const [sections,        setSections]        = useState<SectionItem[]>([]);
  const [dataLoading,     setDataLoading]     = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  const {
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { class_section_id: 0, subject_id: 0, volunteer_1_id: 0, volunteer_2_id: 0 },
  });

  const sectionId = watch('class_section_id');
  const subjectId = watch('subject_id');
  const vol1Id    = watch('volunteer_1_id');
  const vol2Id    = watch('volunteer_2_id');

  // Assign button is only ready when all mandatory fields are filled:
  // section + subject + vol1 (vol2 is optional)
  const canSubmit = sectionId > 0 && subjectId > 0 && vol1Id > 0;

  // Derive objects for the preview
  const selectedSection: SectionItem | undefined = prefillSection
    ? { classSectionId: prefillSection.classSectionId, sectionName: prefillSection.sectionName, sectionCode: prefillSection.sectionCode, activeChildrenCount: prefillSection.activeChildrenCount }
    : sections.find((s) => s.classSectionId === sectionId);
  const selectedSubject = subjects.find((s) => s.subjectId === subjectId);
  const selectedVol1    = volunteers.find((v) => v.userId === vol1Id);
  const selectedVol2    = vol2Id ? volunteers.find((v) => v.userId === vol2Id) : undefined;

  function handleClassChange(classId: number) {
    setSelectedClassId(classId);
    setSections([]);
    setValue('class_section_id', 0, { shouldValidate: false });
    setSectionsLoading(true);
    fetchSections(schoolId, classId)
      .then(setSections)
      .catch(() => toast.error('Failed to load sections.'))
      .finally(() => setSectionsLoading(false));
  }

  useEffect(() => {
    if (!open) return;
    reset({
      class_section_id: prefillSection?.classSectionId ?? 0,
      subject_id: 0,
      volunteer_1_id: 0,
      volunteer_2_id: 0,
    });
    setSelectedClassId(null);
    setSections([]);
    setDataLoading(true);
    Promise.all([
      prefillSection ? Promise.resolve([]) : fetchSchoolClasses(schoolId),
      fetchSubjects(),
      fetchVolunteers(schoolId),
    ])
      .then(([cls, subs, volRes]) => {
        setClasses(cls as SchoolClassItem[]);
        setSubjects(subs);
        setVolunteers(volRes.volunteers);
      })
      .catch(() => toast.error('Failed to load form data.'))
      .finally(() => setDataLoading(false));
  }, [open, schoolId, reset, prefillSection]);

  const usedSectionNames = new Set(existingSlotClasses.map((s) => s.sectionName));
  const usedVolIds       = new Set(
    existingSlotClasses.flatMap((s) => s.volunteers.map((v) => v.userId))
  );

  async function onSubmit(values: FormValues) {
    try {
      const result = await createSlotClass(schoolId, slot.slotId, {
        class_section_id: values.class_section_id,
        subject_id:       values.subject_id,
        volunteer_1_id:   values.volunteer_1_id,
        volunteer_2_id:   values.volunteer_2_id || null,
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
              section={selectedSection}
              subject={selectedSubject}
              vol1={selectedVol1}
              vol2={selectedVol2}
            />
          </Box>

          {dataLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={28} sx={{ color: '#2563EB' }} />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', minHeight: 300 }}>

              {/* ── Left column: Class + Section ─────────────────────────────── */}
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
                {prefillSection ? (
                  /* Pre-selected from table cell — read-only */
                  <Box>
                    <ColumnLabel>Section</ColumnLabel>
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
                          {prefillSection.sectionCode}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1E40AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {prefillSection.sectionName}
                        </Typography>
                        <Typography sx={{ fontSize: '11px', color: '#3B82F6' }}>
                          {prefillSection.activeChildrenCount}/{MAX_CAP} children
                        </Typography>
                      </Box>
                      <Check size={14} color="#2563EB" strokeWidth={2.5} />
                    </Box>
                    <Typography sx={{ fontSize: '11px', color: MUTED, mt: 0.75 }}>
                      Pre-selected from schedule
                    </Typography>
                  </Box>
                ) : (
                  /* Normal class + section picker */
                  <>
                    <Box>
                      <ColumnLabel required>Class</ColumnLabel>
                      <ClassPicker
                        classes={classes}
                        value={selectedClassId}
                        onChange={handleClassChange}
                        error={Boolean(errors.class_section_id) && !selectedClassId}
                      />
                    </Box>

                    {selectedClassId !== null && (
                      <Box>
                        <ColumnLabel required>Section</ColumnLabel>
                        <SectionPicker
                          sections={sections}
                          loading={sectionsLoading}
                          usedSectionNames={usedSectionNames}
                          value={sectionId}
                          onChange={(id) => setValue('class_section_id', id, { shouldValidate: true })}
                          error={Boolean(errors.class_section_id) && !sectionsLoading}
                        />
                      </Box>
                    )}

                    {!selectedClassId && (
                      <Box
                        sx={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 0.5,
                          opacity: 0.4,
                        }}
                      >
                        <Box sx={{ width: 32, height: 32, borderRadius: '8px', border: `2px dashed ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography sx={{ fontSize: '16px', color: MUTED }}>?</Typography>
                        </Box>
                        <Typography sx={{ fontSize: '11px', color: MUTED, textAlign: 'center' }}>
                          Pick a class to see sections
                        </Typography>
                      </Box>
                    )}
                  </>
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
                {/* Subject */}
                <Box>
                  <ColumnLabel required>Subject</ColumnLabel>
                  <SubjectPicker
                    subjects={subjects}
                    value={subjectId}
                    onChange={(id) => setValue('subject_id', id, { shouldValidate: true })}
                    error={Boolean(errors.subject_id)}
                  />
                  {errors.subject_id && (
                    <Typography sx={{ fontSize: '11px', color: '#EF4444', mt: 0.5 }}>
                      {errors.subject_id.message}
                    </Typography>
                  )}
                </Box>

                {/* Volunteers — side-by-side columns */}
                <Box>
                  <ColumnLabel>Volunteers</ColumnLabel>
                  {volunteers.length === 0 ? (
                    <Box sx={{ p: 2, borderRadius: '8px', border: `1px dashed ${BORDER}`, textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '12px', color: MUTED }}>No volunteers found for this school.</Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                      {/* Vol 1 */}
                      <Box>
                        <SubLabel required>Vol 1</SubLabel>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.625, maxHeight: 240, overflowY: 'auto', pr: 0.5 }}>
                          {volunteers.map((v) => {
                            const isVol2   = v.userId === vol2Id;
                            const busy     = usedVolIds.has(v.userId);
                            const disabled = busy || isVol2;
                            const reason   = isVol2 ? 'Selected as Vol 2' : busy ? 'Already in slot' : undefined;
                            return (
                              <CompactVolCard
                                key={v.userId}
                                volunteer={v}
                                selected={vol1Id === v.userId}
                                disabled={disabled}
                                disabledReason={reason}
                                onClick={() => setValue('volunteer_1_id', v.userId, { shouldValidate: true })}
                              />
                            );
                          })}
                        </Box>
                        {errors.volunteer_1_id && (
                          <Typography sx={{ fontSize: '11px', color: '#EF4444', mt: 0.5 }}>
                            {errors.volunteer_1_id.message}
                          </Typography>
                        )}
                      </Box>

                      {/* Vol 2 */}
                      <Box>
                        <SubLabel optional>Vol 2</SubLabel>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.625, maxHeight: 240, overflowY: 'auto', pr: 0.5 }}>
                          <NoneCard
                            selected={vol2Id === 0}
                            onClick={() => setValue('volunteer_2_id', 0, { shouldValidate: true })}
                          />
                          {volunteers.map((v) => {
                            const isVol1   = v.userId === vol1Id;
                            const busy     = usedVolIds.has(v.userId);
                            const disabled = isVol1 || busy;
                            const reason   = isVol1 ? 'Selected as Vol 1' : busy ? 'Already in slot' : undefined;
                            return (
                              <CompactVolCard
                                key={v.userId}
                                volunteer={v}
                                selected={vol2Id === v.userId}
                                disabled={disabled}
                                disabledReason={reason}
                                onClick={() => setValue('volunteer_2_id', v.userId, { shouldValidate: true })}
                              />
                            );
                          })}
                        </Box>
                        {errors.volunteer_2_id && (
                          <Typography sx={{ fontSize: '11px', color: '#EF4444', mt: 0.5 }}>
                            {errors.volunteer_2_id.message}
                          </Typography>
                        )}
                      </Box>
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
