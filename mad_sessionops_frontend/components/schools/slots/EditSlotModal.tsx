'use client';

import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import { X, Clock } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateSlot, type SlotItem, type DayOfWeek } from '@/lib/api/services/slots.service';

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

// ── Schema ─────────────────────────────────────────────────────────────────────

const DAY_ENUM = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const schema = z
  .object({
    day_of_week: z.enum(DAY_ENUM, { error: 'Select a day' }),
    start_time:  z.string().min(1, 'Required'),
    end_time:    z.string().min(1, 'Required'),
  })
  .refine(
    (d) => !d.start_time || !d.end_time || d.start_time < d.end_time,
    { message: 'Start time must be before end time', path: ['end_time'] }
  );

type FormValues = z.infer<typeof schema>;

// ── Day picker ────────────────────────────────────────────────────────────────

const DAYS: { value: DayOfWeek; short: string }[] = [
  { value: 'monday',    short: 'Mon' },
  { value: 'tuesday',   short: 'Tue' },
  { value: 'wednesday', short: 'Wed' },
  { value: 'thursday',  short: 'Thu' },
  { value: 'friday',    short: 'Fri' },
  { value: 'saturday',  short: 'Sat' },
  { value: 'sunday',    short: 'Sun' },
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

function DayPicker({
  value,
  onChange,
  error,
}: {
  value: DayOfWeek | undefined;
  onChange: (v: DayOfWeek) => void;
  error?: boolean;
}) {
  return (
    <Box>
      <Typography sx={{ fontSize: '12px', fontWeight: 600, color: LABEL, mb: 0.75 }}>
        Day of week <Typography component="span" sx={{ color: '#EF4444', fontSize: '12px' }}>*</Typography>
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          border: `1.5px solid ${error ? '#EF4444' : BORDER}`,
          borderRadius: '10px',
          overflow: 'hidden',
          bgcolor: '#FAFAFA',
        }}
      >
        {DAYS.map((d, i) => {
          const active = value === d.value;
          return (
            <Box
              key={d.value}
              onClick={() => onChange(d.value)}
              sx={{
                py: 1.25,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                borderRight: i < DAYS.length - 1 ? `1px solid ${active ? '#2563EB' : BORDER}` : 'none',
                bgcolor: active ? '#2563EB' : 'transparent',
                transition: 'background 0.12s ease',
                '&:hover': { bgcolor: active ? '#1D4ED8' : '#EFF6FF' },
              }}
            >
              <Typography sx={{ fontSize: '11px', fontWeight: active ? 700 : 500, color: active ? '#fff' : '#64748B' }}>
                {d.short}
              </Typography>
            </Box>
          );
        })}
      </Box>
      {error && (
        <Typography sx={{ fontSize: '11px', color: '#EF4444', mt: 0.5 }}>Select a day</Typography>
      )}
    </Box>
  );
}

// ── Preview pill ──────────────────────────────────────────────────────────────

function formatTime12(t: string): string {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${mStr} ${ampm}`;
}

function SlotPreview({ day, startTime, endTime }: { day?: DayOfWeek; startTime: string; endTime: string }) {
  const dayLabel = day ? DAY_LABELS[day] : '';
  if (!dayLabel || !startTime || !endTime || startTime >= endTime) return null;
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        px: 2,
        py: 1.25,
        borderRadius: '10px',
        bgcolor: '#EFF6FF',
        border: '1.5px solid #BFDBFE',
      }}
    >
      <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Clock size={15} strokeWidth={2} color="#fff" />
      </Box>
      <Box>
        <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1E40AF' }}>
          {dayLabel} {startTime}
        </Typography>
        <Typography sx={{ fontSize: '11px', color: '#3B82F6' }}>
          {formatTime12(startTime)} – {formatTime12(endTime)}
        </Typography>
      </Box>
    </Box>
  );
}

// ── Helpers — convert "HH:MM:SS" → "HH:MM" for time input ────────────────────

function toInputTime(t: string): string {
  return t ? t.slice(0, 5) : '';
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface EditSlotModalProps {
  open: boolean;
  schoolId: number;
  slot: SlotItem;
  onClose: () => void;
  onSaved: (slot: SlotItem) => void;
}

export function EditSlotModal({ open, schoolId, slot, onClose, onSaved }: EditSlotModalProps) {
  const [apiError, setApiError] = useState('');

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      day_of_week: slot.dayOfWeek,
      start_time:  toInputTime(slot.startTime),
      end_time:    toInputTime(slot.endTime),
    },
  });

  // Re-populate when the slot prop changes (e.g. user edits a different slot)
  useEffect(() => {
    if (open) {
      reset({
        day_of_week: slot.dayOfWeek,
        start_time:  toInputTime(slot.startTime),
        end_time:    toInputTime(slot.endTime),
      });
      setApiError('');
    }
  }, [open, slot, reset]);

  const day       = watch('day_of_week');
  const startTime = watch('start_time');
  const endTime   = watch('end_time');

  function handleClose() {
    if (isSubmitting) return;
    onClose();
  }

  async function onSubmit(values: FormValues) {
    setApiError('');
    try {
      const updated = await updateSlot(schoolId, slot.slotId, {
        day_of_week: values.day_of_week,
        start_time:  values.start_time + ':00',
        end_time:    values.end_time   + ':00',
      });
      onSaved(updated);
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setApiError(err?.response?.data?.error?.message ?? err?.message ?? 'Failed to update slot.');
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
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          pt: 2.5, pb: 1.5, px: 3,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <Box>
          <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>Edit Slot</Typography>
          <Typography sx={{ fontSize: '11px', color: MUTED, mt: 0.25 }}>
            Slot name updates automatically
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleClose} sx={{ mt: 0.25, color: MUTED, '&:hover': { bgcolor: '#F1F5F9' } }}>
          <X size={16} />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Controller
              name="day_of_week"
              control={control}
              render={({ field }) => (
                <DayPicker
                  value={field.value as DayOfWeek | undefined}
                  onChange={field.onChange}
                  error={!!errors.day_of_week}
                />
              )}
            />

            <Box>
              <Typography sx={{ fontSize: '12px', fontWeight: 600, color: LABEL, mb: 0.75 }}>
                Time range <Typography component="span" sx={{ color: '#EF4444', fontSize: '12px' }}>*</Typography>
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <Controller
                  name="start_time"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      type="time"
                      size="small"
                      fullWidth
                      label="Start"
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.start_time}
                      helperText={errors.start_time?.message}
                      sx={fieldSx}
                    />
                  )}
                />
                <Controller
                  name="end_time"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      type="time"
                      size="small"
                      fullWidth
                      label="End"
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.end_time}
                      helperText={errors.end_time?.message}
                      sx={fieldSx}
                    />
                  )}
                />
              </Box>
            </Box>

            <SlotPreview day={day} startTime={startTime} endTime={endTime} />

            {apiError && (
              <Typography sx={{ fontSize: '12px', color: '#EF4444' }}>{apiError}</Typography>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${BORDER}`, gap: 1 }}>
          <Button
            onClick={handleClose}
            variant="outlined"
            size="small"
            disabled={isSubmitting}
            sx={{ fontSize: '13px', borderColor: BORDER, color: '#64748B', '&:hover': { borderColor: '#CBD5E1', bgcolor: '#F8FAFC' } }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            size="small"
            disabled={isSubmitting}
            sx={{ fontSize: '13px', fontWeight: 600, minWidth: 80, bgcolor: '#2563EB', boxShadow: 'none', '&:hover': { bgcolor: '#1D4ED8', boxShadow: 'none' } }}
          >
            {isSubmitting ? <CircularProgress size={14} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
