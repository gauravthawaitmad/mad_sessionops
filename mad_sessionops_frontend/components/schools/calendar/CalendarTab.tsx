'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import { AlertCircle, CalendarDays, ArrowRight, Clock } from 'lucide-react';
import Button from '@mui/material/Button';
import { Plus } from 'lucide-react';
import { fetchSchoolSession, type SessionOut } from '@/lib/api/services/sessions.service';
import { fetchHolidays, type HolidayOut } from '@/lib/api/services/holidays.service';
import { CalendarEmptyState } from './CalendarEmptyState';
import { SetSessionModal } from './SetSessionModal';
import { CalendarMonthGrid } from './CalendarMonthGrid';
import { AddHolidayModal } from './AddHolidayModal';
import { EditHolidayModal } from './EditHolidayModal';
import { DeleteHolidayModal } from './DeleteHolidayModal';
import { colors } from '@/config/design-tokens';

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CalendarSkeleton() {
  return (
    <Box sx={{ px: 4, pt: 3, pb: 6 }}>
      <Skeleton width={240} height={16} sx={{ mb: 3 }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={72} sx={{ borderRadius: '8px' }} />
        ))}
      </Box>
    </Box>
  );
}

// ── Configured-state header ───────────────────────────────────────────────────

function SessionHeader({ session, onAddHoliday }: { session: SessionOut; onAddHoliday: () => void }) {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const start    = new Date(session.startDate);
  const end      = new Date(session.endDate);
  const today    = new Date();
  const total    = end.getTime() - start.getTime();
  const elapsed  = Math.min(Math.max(today.getTime() - start.getTime(), 0), total);
  const pct      = total > 0 ? Math.round((elapsed / total) * 100) : 0;
  const active   = today >= start && today <= end;
  const upcoming = today < start;

  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  const durationLabel = months > 0 ? `${months} months` : `${Math.round(total / 86_400_000)} days`;

  return (
    <Box
      sx={{
        px: 4,
        py: 2,
        borderBottom: `1px solid ${colors.gray[200]}`,
        bgcolor: '#fff',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', minHeight: 36 }}>
        {/* Session: label */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <CalendarDays size={14} strokeWidth={1.75} color={colors.primary[500]} />
          <Typography sx={{ fontSize: '12px', fontWeight: 600, color: colors.gray[500], letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Session:
          </Typography>
        </Box>

        {/* Date range pill */}
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.5,
            py: 0.5,
            borderRadius: '20px',
            bgcolor: colors.primary[50],
            border: `1px solid ${colors.primary[200]}`,
          }}
        >
          <Typography sx={{ fontSize: '13px', fontWeight: 700, color: colors.primary[700] }}>
            {fmt(session.startDate)}
          </Typography>
          <ArrowRight size={12} strokeWidth={2.5} color={colors.primary[400]} />
          <Typography sx={{ fontSize: '13px', fontWeight: 700, color: colors.primary[700] }}>
            {fmt(session.endDate)}
          </Typography>
        </Box>

        {/* Duration chip */}
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1.25,
            py: 0.375,
            borderRadius: '20px',
            bgcolor: colors.gray[100],
            border: `1px solid ${colors.gray[200]}`,
          }}
        >
          <Clock size={11} strokeWidth={2} color={colors.gray[500]} />
          <Typography sx={{ fontSize: '11px', fontWeight: 600, color: colors.gray[600] }}>
            {durationLabel}
          </Typography>
        </Box>

        {/* Status badge */}
        {active && (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.375, borderRadius: '20px', bgcolor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#16A34A' }} />
            <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#15803D' }}>Active</Typography>
          </Box>
        )}
        {upcoming && (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.375, borderRadius: '20px', bgcolor: colors.primary[50], border: `1px solid ${colors.primary[200]}` }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 600, color: colors.primary[700] }}>Upcoming</Typography>
          </Box>
        )}
        {!active && !upcoming && (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.375, borderRadius: '20px', bgcolor: colors.gray[100], border: `1px solid ${colors.gray[200]}` }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 600, color: colors.gray[500] }}>Completed</Typography>
          </Box>
        )}

        {/* Add Holiday button — right-aligned in the same toolbar row */}
        <Box sx={{ ml: 'auto' }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<Plus size={13} strokeWidth={2.5} />}
            onClick={onAddHoliday}
            sx={{
              textTransform: 'none', fontSize: '12px', fontWeight: 600,
              bgcolor: '#7C3AED', boxShadow: 'none',
              '&:hover': { bgcolor: '#6D28D9', boxShadow: 'none' },
              px: 1.5,
            }}
          >
            Add Holiday
          </Button>
        </Box>
      </Box>

      {/* Progress bar — only shown when active */}
      {active && (
        <Box sx={{ mt: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography sx={{ fontSize: '10px', color: colors.gray[400] }}>Session progress</Typography>
            <Typography sx={{ fontSize: '10px', fontWeight: 600, color: colors.primary[600] }}>{pct}%</Typography>
          </Box>
          <Box sx={{ height: 5, bgcolor: colors.gray[100], borderRadius: '99px', overflow: 'hidden' }}>
            <Box
              sx={{
                height: '100%',
                width: `${pct}%`,
                borderRadius: '99px',
                background: `linear-gradient(90deg, ${colors.primary[400]}, ${colors.primary[600]})`,
                transition: 'width 0.6s ease',
              }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface CalendarTabProps {
  schoolId: number;
}

export function CalendarTab({ schoolId }: CalendarTabProps) {
  const [session, setSession]     = useState<SessionOut | null>(null);
  const [holidays, setHolidays]   = useState<HolidayOut[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const [isSetSessionOpen, setIsSetSessionOpen] = useState(false);
  const [isAddHolidayOpen, setIsAddHolidayOpen] = useState(false);
  const [editingHoliday, setEditingHoliday]     = useState<HolidayOut | null>(null);
  const [deletingHoliday, setDeletingHoliday]   = useState<HolidayOut | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchSchoolSession(schoolId),
      fetchHolidays(schoolId).catch(() => [] as HolidayOut[]),
    ])
      .then(([sess, hols]) => {
        if (!cancelled) {
          setSession(sess);
          setHolidays(hols);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'Failed to load calendar data.');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [schoolId]);

  // Loading
  if (loading) {
    return <CalendarSkeleton />;
  }

  // Unexpected error
  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
          gap: 1.5,
          px: 4,
          py: 8,
        }}
      >
        <AlertCircle size={28} strokeWidth={1.5} color={colors.error[400]} />
        <Typography sx={{ fontSize: '14px', color: colors.gray[600], textAlign: 'center', maxWidth: 320 }}>
          {error}
        </Typography>
      </Box>
    );
  }

  // No session — show empty state + session modal
  if (!session) {
    return (
      <>
        <CalendarEmptyState onConfigure={() => setIsSetSessionOpen(true)} />
        <SetSessionModal
          open={isSetSessionOpen}
          schoolId={schoolId}
          onClose={() => setIsSetSessionOpen(false)}
          onSessionCreated={(newSession) => {
            setIsSetSessionOpen(false);
            setSession(newSession);
          }}
        />
      </>
    );
  }

  // Session configured — full calendar view
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <SessionHeader session={session} onAddHoliday={() => setIsAddHolidayOpen(true)} />

      {/* Month grid */}
      <CalendarMonthGrid
        session={session}
        holidays={holidays}
        onHolidayClick={setEditingHoliday}
      />

      {/* Modals */}
      <AddHolidayModal
        open={isAddHolidayOpen}
        schoolId={schoolId}
        session={session}
        onClose={() => setIsAddHolidayOpen(false)}
        onCreated={(h) => { setHolidays((prev) => [...prev, h]); setIsAddHolidayOpen(false); }}
      />
      <EditHolidayModal
        open={!!editingHoliday}
        holiday={editingHoliday}
        session={session}
        schoolId={schoolId}
        onClose={() => setEditingHoliday(null)}
        onDelete={(h) => { setEditingHoliday(null); setDeletingHoliday(h); }}
        onUpdated={(updated) => {
          const oldId = editingHoliday?.schoolHolidayId ?? -1;
          setHolidays((prev) => {
            // In-place edit: same id
            if (updated.schoolHolidayId === oldId) {
              return prev.map((h) => h.schoolHolidayId === oldId ? updated : h);
            }
            // Date change: remove old, append new
            return [...prev.filter((h) => h.schoolHolidayId !== oldId), updated];
          });
          setEditingHoliday(null);
        }}
      />
      <DeleteHolidayModal
        open={!!deletingHoliday}
        holiday={deletingHoliday}
        schoolId={schoolId}
        onClose={() => setDeletingHoliday(null)}
        onDeleted={(id) => { setHolidays((prev) => prev.filter((h) => h.schoolHolidayId !== id)); setDeletingHoliday(null); }}
      />
    </Box>
  );
}
