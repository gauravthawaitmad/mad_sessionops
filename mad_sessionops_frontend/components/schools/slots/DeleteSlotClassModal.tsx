'use client';

import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { AlertTriangle } from 'lucide-react';
import { deleteSlotClass, type SlotClassItem } from '@/lib/api/services/slot_classes.service';

const BORDER = '#E2E8F0';

interface DeleteSlotClassModalProps {
  open: boolean;
  schoolId: number;
  slotId: number;
  slotClass: SlotClassItem | null;
  onClose: () => void;
  onDeleted: (scsId: number) => void;
}

export function DeleteSlotClassModal({
  open,
  schoolId,
  slotId,
  slotClass,
  onClose,
  onDeleted,
}: DeleteSlotClassModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState('');

  function handleClose() {
    if (deleting) return;
    setError('');
    onClose();
  }

  async function handleDelete() {
    if (!slotClass) return;
    setDeleting(true);
    setError('');
    try {
      await deleteSlotClass(schoolId, slotId, slotClass.slotClassSectionId);
      onDeleted(slotClass.slotClassSectionId);
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setError(err?.response?.data?.error?.message ?? err?.message ?? 'Failed to remove class assignment.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' } }}
    >
      <DialogTitle sx={{ pt: 2.5, pb: 1.5, px: 3, borderBottom: `1px solid ${BORDER}` }}>
        <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
          Remove Class Assignment
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            py: 1,
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              bgcolor: '#FEF2F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={20} strokeWidth={1.5} color="#EF4444" />
          </Box>

          <Box>
            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#1E293B', mb: 0.5 }}>
              Remove &ldquo;{slotClass?.sectionName}&rdquo;?
            </Typography>
            <Typography sx={{ fontSize: '13px', color: '#64748B', lineHeight: 1.6 }}>
              This will remove the <strong>{slotClass?.subjectName}</strong> class assignment
              from this slot. This action cannot be undone.
            </Typography>
          </Box>

          {error && (
            <Typography sx={{ fontSize: '12px', color: '#EF4444' }}>{error}</Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${BORDER}`, gap: 1 }}>
        <Button
          onClick={handleClose}
          variant="outlined"
          size="small"
          disabled={deleting}
          sx={{
            fontSize: '13px',
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
          onClick={handleDelete}
          disabled={deleting}
          sx={{
            fontSize: '13px',
            fontWeight: 600,
            minWidth: 80,
            bgcolor: '#EF4444',
            boxShadow: 'none',
            '&:hover': { bgcolor: '#DC2626', boxShadow: 'none' },
            '&.Mui-disabled': { bgcolor: '#FECACA', color: '#fff' },
          }}
        >
          {deleting ? <CircularProgress size={14} color="inherit" /> : 'Remove'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
