'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import LinearProgress from '@mui/material/LinearProgress';
import { Plus, MoreVertical, BookOpen, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import {
  fetchSchoolClasses,
  fetchSections,
  removeSchoolClass,
  removeSection,
  type SchoolClassItem,
  type SectionItem,
} from '@/lib/api/services/structure.service';
import { showApiError } from '@/lib/toast/toast';
import { AddClassModal } from './AddClassModal';
import { AddSectionModal } from './AddSectionModal';

// ── Constants ──────────────────────────────────────────────────────────────────
const MAX_CAPACITY = 5;

// ── Colors ─────────────────────────────────────────────────────────────────────
const CARD_BORDER  = '#E2E8F0';
const TEXT_MUTED   = '#94A3B8';
const TEXT_DEFAULT = '#475569';
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

// ── Props ──────────────────────────────────────────────────────────────────────
interface StructureTabProps {
  schoolId: number;
  activeYear: string;
  canModify?: boolean;
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd?: () => void }) {
  return (
    <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
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
        <Layers size={22} strokeWidth={1.5} color={TEXT_MUTED} />
      </Box>
      <Typography sx={{ fontSize: '15px', fontWeight: 600, color: TEXT_STRONG }}>
        No classes added yet.
      </Typography>
      <Typography sx={{ fontSize: '13px', color: TEXT_MUTED, textAlign: 'center', maxWidth: 300 }}>
        Add a class from the catalog to start building the school&apos;s structure.
      </Typography>
      {onAdd && (
        <Button variant="contained" size="small" startIcon={<Plus size={14} />} onClick={onAdd} sx={{ mt: 1 }}>
          Add Class
        </Button>
      )}
    </Box>
  );
}

// ── Remove confirmation dialogs ────────────────────────────────────────────────
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
        <Typography sx={{ fontSize: '14px', color: TEXT_DEFAULT }}>
          Remove <strong>{className}</strong> from this school? This cannot be undone while sections
          exist under it.
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

function RemoveSectionDialog({
  open,
  sectionName,
  onCancel,
  onConfirm,
  confirming,
}: {
  open: boolean;
  sectionName: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: '15px', fontWeight: 700 }}>Remove Section</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: '14px', color: TEXT_DEFAULT }}>
          Remove <strong>{sectionName}</strong>? This cannot be undone while children are enrolled.
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

// ── Section card ───────────────────────────────────────────────────────────────
function SectionCard({ section, onRemove }: { section: SectionItem; onRemove: () => void }) {
  const count = section.activeChildrenCount;
  const color = capacityColor(count);
  const pct = Math.min((count / MAX_CAPACITY) * 100, 100);
  const isFull = count >= MAX_CAPACITY;
  const openSeats = MAX_CAPACITY - count;

  return (
    <Box
      sx={{
        position: 'relative',
        p: 1.5,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: '10px',
        bgcolor: '#fff',
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '8px',
          bgcolor: color + '1A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 1,
        }}
      >
        <Typography sx={{ fontSize: '16px', fontWeight: 700, color, lineHeight: 1 }}>
          {section.sectionCode}
        </Typography>
      </Box>

      <Typography sx={{ fontSize: '12px', fontWeight: 600, color: TEXT_STRONG, mb: 0.75, pr: 2.5 }}>
        {section.sectionName}
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
        {isFull ? `Full · ${MAX_CAPACITY}/${MAX_CAPACITY}` : `${count}/${MAX_CAPACITY} · ${openSeats} open`}
      </Typography>

      <Tooltip title="Remove section">
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          sx={{ position: 'absolute', top: 6, right: 6, p: 0.4, '&:hover': { bgcolor: '#FEE2E2' } }}
        >
          <MoreVertical size={12} strokeWidth={2} color={TEXT_MUTED} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

// ── Class card ─────────────────────────────────────────────────────────────────
function ClassCard({
  schoolClass,
  schoolId,
  onRemove,
}: {
  schoolClass: SchoolClassItem;
  schoolId: number;
  onRemove: (sc: SchoolClassItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<SectionItem | null>(null);
  const [removingSection, setRemovingSection] = useState(false);
  const [sectionError, setSectionError] = useState('');

  const displayCount = expanded && !sectionsLoading ? sections.length : schoolClass.sectionsCount;

  useEffect(() => {
    if (!expanded) return;
    setSectionsLoading(true);
    setSectionError('');
    fetchSections(schoolId, schoolClass.schoolClassId)
      .then(setSections)
      .catch(() => setSectionError('Failed to load sections.'))
      .finally(() => setSectionsLoading(false));
  }, [expanded, schoolId, schoolClass.schoolClassId]);

  async function handleRemoveSectionConfirm() {
    if (!removeTarget) return;
    setRemovingSection(true);
    setSectionError('');
    try {
      await removeSection(schoolId, removeTarget.classSectionId);
      setSections((prev) => prev.filter((s) => s.classSectionId !== removeTarget.classSectionId));
      setRemoveTarget(null);
    } catch (err: any) {
      setRemoveTarget(null);
      showApiError(err);
    } finally {
      setRemovingSection(false);
    }
  }

  return (
    <>
      <Box
        sx={{
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: '10px',
          overflow: 'hidden',
          bgcolor: '#fff',
          mb: 1.5,
        }}
      >
        {/* Card header — always visible */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 2.5,
            py: 1.75,
            gap: 1.5,
            cursor: 'pointer',
            '&:hover': { bgcolor: '#F8FAFC' },
          }}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded
            ? <ChevronDown size={15} strokeWidth={2} color={TEXT_MUTED} />
            : <ChevronRight size={15} strokeWidth={2} color={TEXT_MUTED} />
          }

          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: '8px',
              bgcolor: '#EFF6FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <BookOpen size={16} strokeWidth={1.75} color={ACCENT} />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: TEXT_STRONG }}>
              {schoolClass.className}
            </Typography>
            <Typography sx={{ fontSize: '12px', color: TEXT_MUTED }}>
              {schoolClass.programName}
            </Typography>
          </Box>

          <Chip
            label={`${displayCount} section${displayCount !== 1 ? 's' : ''}`}
            size="small"
            sx={{ fontSize: '11px', height: 20, bgcolor: '#F1F5F9', color: TEXT_DEFAULT }}
            onClick={(e) => e.stopPropagation()}
          />

          {/* Add section button — always visible in header */}
          <Tooltip title="Add section">
            <Button
              size="small"
              variant="outlined"
              startIcon={<Plus size={12} />}
              onClick={(e) => { e.stopPropagation(); setAddSectionOpen(true); }}
              sx={{
                fontSize: '11px',
                py: 0.4,
                px: 1,
                minWidth: 0,
                borderColor: CARD_BORDER,
                color: TEXT_DEFAULT,
                '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: '#EFF6FF' },
              }}
            >
              Section
            </Button>
          </Tooltip>

          <Tooltip title="Options">
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}
            >
              <MoreVertical size={15} strokeWidth={2} color={TEXT_MUTED} />
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            onClick={(e) => e.stopPropagation()}
          >
            <MenuItem
              onClick={() => { setMenuAnchor(null); onRemove(schoolClass); }}
              sx={{ fontSize: '13px', color: DANGER }}
            >
              Remove class
            </MenuItem>
          </Menu>
        </Box>

        {/* Expanded: section cards */}
        {expanded && (
          <Box sx={{ borderTop: `1px solid ${CARD_BORDER}`, px: 2.5, py: 2, bgcolor: '#FAFAFA' }}>
            {sectionsLoading && (
              <CircularProgress size={18} sx={{ display: 'block', mx: 'auto', my: 1 }} />
            )}

            {!sectionsLoading && sectionError && (
              <Typography sx={{ fontSize: '13px', color: DANGER, mb: 1 }}>{sectionError}</Typography>
            )}

            {!sectionsLoading && !sectionError && sections.length === 0 && (
              <Typography sx={{ fontSize: '13px', color: TEXT_MUTED }}>
                No sections yet. Use the &ldquo;+ Section&rdquo; button above to add one.
              </Typography>
            )}

            {!sectionsLoading && sections.length > 0 && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))',
                  gap: 1.5,
                }}
              >
                {sections.map((s) => (
                  <SectionCard
                    key={s.classSectionId}
                    section={s}
                    onRemove={() => { setSectionError(''); setRemoveTarget(s); }}
                  />
                ))}
              </Box>
            )}
          </Box>
        )}
      </Box>

      <AddSectionModal
        open={addSectionOpen}
        schoolId={schoolId}
        schoolClassId={schoolClass.schoolClassId}
        onClose={() => setAddSectionOpen(false)}
        onAdded={(section) =>
          setSections((prev) =>
            [...prev, section].sort((a, b) => a.sectionCode.localeCompare(b.sectionCode))
          )
        }
      />

      <RemoveSectionDialog
        open={Boolean(removeTarget)}
        sectionName={removeTarget?.sectionName ?? ''}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={handleRemoveSectionConfirm}
        confirming={removingSection}
      />
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function StructureTab({ schoolId, activeYear, canModify = true }: StructureTabProps) {
  const [classes, setClasses] = useState<SchoolClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<SchoolClassItem | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSchoolClasses(schoolId)
      .then((data) => { if (!cancelled) { setClasses(data); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError('Failed to load structure.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [schoolId]);

  async function handleRemoveConfirm() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await removeSchoolClass(schoolId, removeTarget.schoolClassId);
      setClasses((prev) => prev.filter((c) => c.schoolClassId !== removeTarget.schoolClassId));
      setRemoveTarget(null);
    } catch (err: any) {
      setRemoveTarget(null);
      showApiError(err);
    } finally {
      setRemoving(false);
    }
  }

  const existingClassIds = classes.map((c) => c.gradeClassId);

  return (
    <Box sx={{ px: 4, pt: 3, pb: 6 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: '18px', fontWeight: 700, color: TEXT_STRONG }}>
            Structure
          </Typography>
          {activeYear && (
            <Typography sx={{ fontSize: '12px', color: TEXT_MUTED, mt: 0.25 }}>
              Academic Year: {activeYear}
            </Typography>
          )}
        </Box>
        {canModify && (
          <Button
            variant="contained"
            size="small"
            startIcon={<Plus size={14} />}
            onClick={() => setAddOpen(true)}
            disabled={loading}
          >
            Add Class
          </Button>
        )}
      </Box>

      {/* Body */}
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

      {!loading && !error && classes.length === 0 && (
        <EmptyState onAdd={canModify ? () => setAddOpen(true) : undefined} />
      )}

      {!loading && !error && classes.length > 0 && (
        <Box>
          {classes.map((sc) => (
            <ClassCard
              key={sc.schoolClassId}
              schoolClass={sc}
              schoolId={schoolId}
              onRemove={setRemoveTarget}
            />
          ))}
        </Box>
      )}

      <AddClassModal
        open={addOpen}
        schoolId={schoolId}
        existingClassIds={existingClassIds}
        onClose={() => setAddOpen(false)}
        onAdded={(sc) => setClasses((prev) => [...prev, sc])}
      />

      <RemoveClassDialog
        open={Boolean(removeTarget)}
        className={removeTarget?.className ?? ''}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={handleRemoveConfirm}
        confirming={removing}
      />
    </Box>
  );
}

export default StructureTab;
