'use client';

import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import { X } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { deactivateChild, type ChildItem } from '@/lib/api/services/children.service';
import toast from 'react-hot-toast';

// ── Schema ────────────────────────────────────────────────────────────────────

const REASON_OPTIONS = [
  { value: 'inactive',            label: 'Inactive' },
  { value: 'duplicate_entry',     label: 'Duplicate entry' },
  { value: 'wrong_school_class',  label: 'Added to wrong school/class by mistake' },
  { value: 'transferred',         label: 'Transferred to another school' },
  { value: 'dropped_out',         label: 'Dropped out of school' },
  { value: 'family_declined',     label: 'Family does not want the child enrolled' },
  { value: 'child_declined',      label: 'Child no longer interested in participating' },
  { value: 'other',               label: 'Other' },
] as const;

const schema = z
  .object({
    removed_reason: z.enum([
      'inactive', 'duplicate_entry', 'wrong_school_class', 'transferred',
      'dropped_out', 'family_declined', 'child_declined', 'other',
    ]),
    other_details: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.removed_reason === 'other' && !data.other_details?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please provide additional details',
        path: ['other_details'],
      });
    }
  });

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface DeactivateChildModalProps {
  open: boolean;
  schoolId: number;
  child: ChildItem;
  onClose: () => void;
  onSuccess: () => void;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const BORDER = '#E2E8F0';
const MUTED  = '#94A3B8';
const LABEL  = '#374151';

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    fontSize: '13px',
    bgcolor: '#FAFAFA',
    '& fieldset': { borderColor: BORDER },
    '&:hover fieldset': { borderColor: '#CBD5E1' },
    '&.Mui-focused fieldset': { borderColor: '#2563EB', borderWidth: '1.5px' },
  },
  '& .MuiFormHelperText-root': { fontSize: '11px', mt: 0.5 },
};

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: LABEL, mb: 0.625 }}>
      {children}
      {required && (
        <Typography component="span" sx={{ color: '#EF4444', ml: 0.25, fontSize: '12px' }}>*</Typography>
      )}
    </Typography>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function DeactivateChildModal({
  open,
  schoolId,
  child,
  onClose,
  onSuccess,
}: DeactivateChildModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const selectedReason = watch('removed_reason');

  function handleClose() {
    reset();
    onClose();
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      await deactivateChild(schoolId, child.childId, {
        removed_reason: values.removed_reason,
        other_details: values.other_details?.trim() || null,
      });
      toast.success(`${child.firstName} ${child.lastName} deactivated`);
      handleClose();
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Deactivation failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '14px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
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
          <Typography sx={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
            Deactivate child
          </Typography>
          <Typography sx={{ fontSize: '12px', color: MUTED, mt: 0.25 }}>
            {child.firstName} {child.lastName}
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

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* Reason dropdown */}
            <Box>
              <FieldLabel required>Reason for deactivation</FieldLabel>
              <Controller
                name="removed_reason"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth size="small" error={!!errors.removed_reason}>
                    <Select
                      {...field}
                      displayEmpty
                      value={field.value ?? ''}
                      sx={{
                        fontSize: '13px',
                        bgcolor: '#FAFAFA',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: errors.removed_reason ? '#EF4444' : BORDER },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2563EB', borderWidth: '1.5px' },
                      }}
                    >
                      <MenuItem value="" disabled sx={{ fontSize: '13px', color: MUTED }}>
                        Select a reason…
                      </MenuItem>
                      {REASON_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '13px' }}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.removed_reason && (
                      <FormHelperText sx={{ fontSize: '11px' }}>
                        {errors.removed_reason.message}
                      </FormHelperText>
                    )}
                  </FormControl>
                )}
              />
            </Box>

            {/* Additional details — required when reason = "other" */}
            {selectedReason === 'other' && (
              <Box>
                <FieldLabel required>Additional details</FieldLabel>
                <Controller
                  name="other_details"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      multiline
                      minRows={2}
                      fullWidth
                      size="small"
                      placeholder="Describe the reason…"
                      error={!!errors.other_details}
                      helperText={errors.other_details?.message}
                      sx={fieldSx}
                    />
                  )}
                />
              </Box>
            )}

          </Box>
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
            type="submit"
            variant="contained"
            size="small"
            disabled={submitting}
            sx={{
              fontSize: '13px',
              fontWeight: 600,
              minWidth: 96,
              bgcolor: '#DC2626',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#B91C1C', boxShadow: 'none' },
              '&.Mui-disabled': { bgcolor: '#FECACA', color: '#fff' },
            }}
          >
            {submitting ? <CircularProgress size={14} color="inherit" /> : 'Deactivate'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default DeactivateChildModal;
