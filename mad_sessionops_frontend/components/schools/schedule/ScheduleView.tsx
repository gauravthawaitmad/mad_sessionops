'use client';

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import { Calendar, Clock, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchSchedule, type SchoolSchedule, type ScheduleDay, type ScheduleSlot } from '@/lib/api/services/schedule.service';

// ── Design tokens ─────────────────────────────────────────────────────────────

const BORDER = '#E2E8F0';

const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${mStr} ${ampm}`;
}

// ── SlotClassRow ──────────────────────────────────────────────────────────────

function SlotClassRow({ sc }: { sc: SchoolSchedule['days'][0]['slots'][0]['slotClasses'][0] }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 2,
        px: 2,
        py: 1.5,
        borderRadius: '8px',
        bgcolor: '#F8FAFC',
        border: `1px solid ${BORDER}`,
      }}
    >
      {/* Section + subject */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>
          {sc.sectionName}
        </Typography>
        <Typography sx={{ fontSize: '11px', color: '#64748B', mt: 0.25 }}>
          {sc.subjectName}
        </Typography>
      </Box>

      {/* Volunteers */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'flex-end', flex: 1 }}>
        {sc.volunteers.length === 0 ? (
          <Typography sx={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>No volunteers</Typography>
        ) : sc.volunteers.map((v) => (
          <Chip
            key={v.userId}
            label={v.userDisplayName}
            size="small"
            sx={{
              fontSize: '11px',
              height: 22,
              bgcolor: '#EFF6FF',
              color: '#1E40AF',
              border: '1px solid #BFDBFE',
              '& .MuiChip-label': { px: 1 },
            }}
          />
        ))}
      </Box>

      {/* Children count */}
      {sc.activeChildrenCount > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <Users size={11} color="#94A3B8" />
          <Typography sx={{ fontSize: '11px', color: '#94A3B8' }}>
            {sc.activeChildrenCount}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ── SlotBlock ─────────────────────────────────────────────────────────────────

function SlotBlock({ slot }: { slot: ScheduleSlot }) {
  return (
    <Box
      sx={{
        borderRadius: '10px',
        border: `1px solid ${BORDER}`,
        bgcolor: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* Slot header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.25,
          bgcolor: '#FAFAFA',
          borderBottom: slot.slotClasses.length > 0 ? `1px solid ${BORDER}` : 'none',
        }}
      >
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: '7px',
            bgcolor: '#FFF7ED',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Clock size={14} strokeWidth={1.5} color="#EA580C" />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>
            {slot.slotName}
          </Typography>
          <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
            {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
          </Typography>
        </Box>
        {slot.slotClasses.length > 0 && (
          <Box
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: '12px',
              bgcolor: '#F1F5F9',
              border: `1px solid ${BORDER}`,
            }}
          >
            <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
              {slot.slotClasses.length} {slot.slotClasses.length === 1 ? 'class' : 'classes'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Slot classes */}
      {slot.slotClasses.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, p: 1.5 }}>
          {slot.slotClasses.map((sc) => (
            <SlotClassRow key={sc.slotClassSectionId} sc={sc} />
          ))}
        </Box>
      )}

      {slot.slotClasses.length === 0 && (
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography sx={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>
            No classes assigned.
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ── DaySection ────────────────────────────────────────────────────────────────

function DaySection({ day }: { day: ScheduleDay }) {
  const label = DAY_LABELS[day.dayOfWeek] ?? day.dayOfWeek;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Typography
          sx={{
            fontSize: '12px',
            fontWeight: 700,
            color: '#94A3B8',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {label}
        </Typography>
        {day.slots.length > 0 && (
          <Typography sx={{ fontSize: '11px', color: '#CBD5E1' }}>
            {day.slots.length} {day.slots.length === 1 ? 'slot' : 'slots'}
          </Typography>
        )}
      </Box>

      {day.slots.length === 0 ? (
        <Typography sx={{ fontSize: '13px', color: '#CBD5E1', fontStyle: 'italic', pl: 0.5 }}>
          No slots scheduled.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {day.slots.map((slot) => (
            <SlotBlock key={slot.slotId} slot={slot} />
          ))}
        </Box>
      )}
    </Box>
  );
}

// ── ScheduleView ──────────────────────────────────────────────────────────────

interface ScheduleViewProps {
  schoolId: number;
}

export function ScheduleView({ schoolId }: ScheduleViewProps) {
  const [schedule, setSchedule] = useState<SchoolSchedule | null>(null);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSchedule(schoolId);
      setSchedule(data);
    } catch {
      toast.error('Failed to load schedule.');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!schedule) return null;

  const activeDays = schedule.days.filter((d) => d.slots.length > 0);
  const totalSlots = schedule.days.reduce((sum, d) => sum + d.slots.length, 0);
  const totalClasses = schedule.days.reduce(
    (sum, d) => sum + d.slots.reduce((s2, sl) => s2 + sl.slotClasses.length, 0), 0
  );

  return (
    <Box sx={{ px: 4, pt: 3, pb: 6 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '9px',
            bgcolor: '#EFF6FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Calendar size={18} strokeWidth={1.5} color="#2563EB" />
        </Box>
        <Box>
          <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>
            Weekly Schedule
          </Typography>
          <Typography sx={{ fontSize: '12px', color: '#64748B', mt: 0.25 }}>
            {schedule.academicYear} · {totalSlots} {totalSlots === 1 ? 'slot' : 'slots'} · {totalClasses} {totalClasses === 1 ? 'class assignment' : 'class assignments'}
          </Typography>
        </Box>
      </Box>

      {/* Empty state */}
      {totalSlots === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 280,
            gap: 1.5,
            border: `1px dashed ${BORDER}`,
            borderRadius: '12px',
            bgcolor: '#FAFAFA',
          }}
        >
          <Calendar size={28} strokeWidth={1.25} color="#CBD5E1" />
          <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#94A3B8' }}>
            No schedule configured yet.
          </Typography>
          <Typography sx={{ fontSize: '13px', color: '#CBD5E1', textAlign: 'center', maxWidth: 320 }}>
            Add slots and assign class sections to build the schedule.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
          {schedule.days.map((day, idx) => {
            const isLast = idx === schedule.days.length - 1;
            return (
              <Box key={day.dayOfWeek}>
                <DaySection day={day} />
                {!isLast && <Divider sx={{ mt: 3.5 }} />}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
