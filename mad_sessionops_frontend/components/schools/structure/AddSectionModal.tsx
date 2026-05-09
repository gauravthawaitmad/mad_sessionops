'use client';

import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import {
  fetchAvailableSectionCodes,
  addSection,
  type SectionItem,
} from '@/lib/api/services/structure.service';

interface AddSectionModalProps {
  open: boolean;
  schoolId: number;
  schoolClassId: number;
  onClose: () => void;
  onAdded: (section: SectionItem) => void;
}

export function AddSectionModal({
  open,
  schoolId,
  schoolClassId,
  onClose,
  onAdded,
}: AddSectionModalProps) {
  const [codes, setCodes] = useState<string[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setCodesLoading(true);
    setSelectedCode(null);
    setError('');
    fetchAvailableSectionCodes(schoolId, schoolClassId)
      .then(setCodes)
      .catch(() => setError('Failed to load available section codes.'))
      .finally(() => setCodesLoading(false));
  }, [open, schoolId, schoolClassId]);

  async function handleAdd() {
    if (!selectedCode) { setError('Please select a section.'); return; }
    setSaving(true);
    setError('');
    try {
      const section = await addSection(schoolId, schoolClassId, selectedCode);
      onAdded(section);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Failed to add section.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (saving) return;
    setSelectedCode(null);
    setError('');
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: '15px', fontWeight: 700, pb: 1 }}>Add Section</DialogTitle>

      <DialogContent sx={{ pt: '8px !important' }}>
        {codesLoading ? (
          <CircularProgress size={20} sx={{ display: 'block', mx: 'auto', my: 2 }} />
        ) : codes.length === 0 ? (
          <Typography sx={{ fontSize: '13px', color: '#64748B', py: 1 }}>
            All sections (A–L) have already been added to this class.
          </Typography>
        ) : (
          <>
            <Typography sx={{ fontSize: '12px', color: '#64748B', mb: 1.5 }}>
              Select a section code to add
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {codes.map((code) => {
                const selected = selectedCode === code;
                return (
                  <Chip
                    key={code}
                    label={code}
                    onClick={() => { setSelectedCode(code); setError(''); }}
                    sx={{
                      fontSize: '14px',
                      fontWeight: 700,
                      width: 48,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      ...(selected
                        ? {
                            bgcolor: '#2563EB',
                            color: '#fff',
                            border: '1px solid #2563EB',
                            '&:hover': { bgcolor: '#1D4ED8' },
                          }
                        : {
                            bgcolor: '#fff',
                            color: '#475569',
                            border: '1px solid #E2E8F0',
                            '&:hover': { bgcolor: '#EFF6FF', borderColor: '#2563EB', color: '#2563EB' },
                          }),
                    }}
                  />
                );
              })}
            </Box>
          </>
        )}

        {error && (
          <Typography sx={{ fontSize: '12px', color: '#EF4444', mt: 1.5 }}>{error}</Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={saving} size="small">Cancel</Button>
        <Button
          variant="contained"
          size="small"
          onClick={handleAdd}
          disabled={saving || codesLoading || codes.length === 0 || !selectedCode}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}
