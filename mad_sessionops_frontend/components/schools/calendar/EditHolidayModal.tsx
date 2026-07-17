'use client';

import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import { X } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { patchHoliday, type HolidayOut } from '@/lib/api/services/holidays.service';
import { type SessionOut } from '@/lib/api/services/sessions.service';
import { colors } from '@/config/design-tokens';

const REASONS = [
  { value: 'mad_event',                 label: 'MAD event (eg: YEC, etc)' },
  { value: 'holidays',                  label: 'Holidays' },
  { value: 'cancelled_from_school_end', label: "Cancelled from school's end" },
] as const;

const schema = z.object({
  holiday_reason:      z.enum(['mad_event', 'holidays', 'cancelled_from_school_end']),
  start_date:          z.string().min(1, 'Required'),
  end_date:            z.string().min(1, 'Required'),
  holiday_description: z.string().optional(),
  remarks:             z.string().optional(),
}).refine((d) => d.start_date <= d.end_date, {
  message: 'Start date must be on or before end date',
  path: ['end_date'],
});

type Form = z.infer<typeof schema>;

const BORDER = '#E2E8F0';
const LABEL  = '#374151';

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    fontSize: '13px', bgcolor: '#FAFAFA',
    '& fieldset': { borderColor: BORDER },
    '&:hover fieldset': { borderColor: '#CBD5E1' },
    '&.Mui-focused fieldset': { borderColor: colors.primary[600], borderWidth: '1.5px' },
  },
  '& .MuiFormHelperText-root': { fontSize: '11px', mt: 0.5 },
};

interface EditHolidayModalProps {
  open: boolean;
  holiday: HolidayOut | null;
  session: SessionOut;
  schoolId: number;
  onClose: () => void;
  onUpdated: (holiday: HolidayOut) => void;
  onDelete: (holiday: HolidayOut) => void;
}

export function EditHolidayModal({ open, holiday, session, schoolId, onClose, onUpdated, onDelete }: EditHolidayModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { holiday_reason: 'holidays', start_date: '', end_date: '', holiday_description: '', remarks: '' },
  });

  useEffect(() => {
    if (!holiday || !open) return;
    reset({
      holiday_reason:      holiday.holidayReason,
      start_date:          holiday.startDate,
      end_date:            holiday.endDate,
      holiday_description: holiday.holidayDescription ?? '',
      remarks:             holiday.remarks ?? '',
    });
    setSubmitError(null);
  }, [holiday, open, reset]);


  const watchedStart = watch('start_date');
  const watchedEnd   = watch('end_date');

  const handleClose = () => { if (isSubmitting) return; setSubmitError(null); onClose(); };

  const onSubmit = async (values: Form) => {
    if (!holiday) return;
    setSubmitError(null);
    try {
      const patch: Record<string, unknown> = {
        holiday_reason: values.holiday_reason,
        holiday_description: values.holiday_description || null,
        remarks: values.remarks || null,
      };
      if (values.start_date !== holiday.startDate) patch.start_date = values.start_date;
      if (values.end_date   !== holiday.endDate)   patch.end_date   = values.end_date;

      const updated = await patchHoliday(schoolId, holiday.schoolHolidayId, {
        holidayReason:      values.holiday_reason,
        ...(patch.start_date ? { startDate: values.start_date } : {}),
        ...(patch.end_date   ? { endDate:   values.end_date   } : {}),
        holidayDescription: values.holiday_description || null,
        remarks:            values.remarks || null,
      });
      onUpdated(updated);
    } catch (err: any) {
      if (err?.status === 409 || err?.code === 'CONFLICT') {
        setSubmitError(err?.data?.error?.message || 'This holiday overlaps with an existing one.');
      } else {
        setSubmitError(err?.message || 'Failed to update holiday.');
      }
    }
  };

  if (!holiday) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', pt: 2.5, pb: 1.5, px: 3, borderBottom: `1px solid ${BORDER}` }}>
        <Box>
          <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>Edit Holiday</Typography>
          <Typography sx={{ fontSize: '11px', color: '#94A3B8', mt: 0.25 }}>Update the reason, dates, or description</Typography>
        </Box>
        <IconButton size="small" onClick={handleClose} disabled={isSubmitting}
          sx={{ mt: 0.25, color: '#94A3B8', '&:hover': { bgcolor: '#F1F5F9', color: '#475569' } }}>
          <X size={16} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pt: 2.5, pb: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Reason */}
          <Box>
            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: LABEL, mb: 0.75 }}>Reason</Typography>
            <Controller name="holiday_reason" control={control}
              render={({ field }) => (
                <TextField {...field} select size="small" fullWidth error={!!errors.holiday_reason}
                  helperText={errors.holiday_reason?.message} sx={fieldSx}>
                  {REASONS.map((r) => (
                    <MenuItem key={r.value} value={r.value} sx={{ fontSize: '13px' }}>{r.label}</MenuItem>
                  ))}
                </TextField>
              )} />
          </Box>

          {/* Dates */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Box>
              <Typography sx={{ fontSize: '12px', fontWeight: 600, color: LABEL, mb: 0.75 }}>Start date</Typography>
              <Controller name="start_date" control={control}
                render={({ field }) => (
                  <TextField {...field} type="date" size="small" fullWidth
                    error={!!errors.start_date} helperText={errors.start_date?.message}
                    inputProps={{ min: session.startDate, max: watchedEnd || session.endDate }}
                    sx={fieldSx} />
                )} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '12px', fontWeight: 600, color: LABEL, mb: 0.75 }}>End date</Typography>
              <Controller name="end_date" control={control}
                render={({ field }) => (
                  <TextField {...field} type="date" size="small" fullWidth
                    error={!!errors.end_date} helperText={errors.end_date?.message}
                    inputProps={{ min: watchedStart || session.startDate, max: session.endDate }}
                    sx={fieldSx} />
                )} />
            </Box>
          </Box>

          {/* Description */}
          <Box>
            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: LABEL, mb: 0.75 }}>Description <Typography component="span" sx={{ fontSize: '11px', color: colors.gray[400] }}>(optional)</Typography></Typography>
            <Controller name="holiday_description" control={control}
              render={({ field }) => (
                <TextField {...field} size="small" fullWidth multiline rows={2} sx={fieldSx} />
              )} />
          </Box>

          {/* Remarks */}
          <Box>
            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: LABEL, mb: 0.75 }}>Remarks <Typography component="span" sx={{ fontSize: '11px', color: colors.gray[400] }}>(optional)</Typography></Typography>
            <Controller name="remarks" control={control}
              render={({ field }) => (
                <TextField {...field} size="small" fullWidth multiline rows={2} sx={fieldSx} />
              )} />
          </Box>

          {submitError && (
            <Box sx={{ px: 1.5, py: 1, borderRadius: '7px', bgcolor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <Typography sx={{ fontSize: '12px', color: '#DC2626' }}>{submitError}</Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2.25, gap: 1, borderTop: `1px solid ${colors.gray[100]}` }}>
        {/* Delete — left-side danger button */}
        <Button
          onClick={() => { if (!holiday) return; onClose(); onDelete(holiday); }}
          disabled={isSubmitting}
          variant="outlined"
          sx={{
            textTransform: 'none', fontSize: '13px', fontWeight: 500,
            borderColor: '#FECACA', color: '#DC2626',
            '&:hover': { borderColor: '#FCA5A5', bgcolor: '#FEF2F2' },
            mr: 'auto',
          }}
        >
          Delete
        </Button>
        <Button onClick={handleClose} disabled={isSubmitting} variant="outlined"
          sx={{ textTransform: 'none', fontSize: '13px', fontWeight: 500, borderColor: BORDER, color: colors.gray[700], '&:hover': { borderColor: '#CBD5E1', bgcolor: colors.gray[50] } }}>
          Cancel
        </Button>
        <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting} variant="contained"
          sx={{ textTransform: 'none', fontSize: '13px', fontWeight: 600, bgcolor: '#2563EB', boxShadow: 'none', '&:hover': { bgcolor: '#1D4ED8', boxShadow: 'none' }, minWidth: 90 }}>
          {isSubmitting ? <CircularProgress size={15} sx={{ color: '#fff' }} /> : 'Save changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
