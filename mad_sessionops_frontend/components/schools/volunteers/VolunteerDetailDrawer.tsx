'use client';

import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import { X, Mail, Phone, MapPin, Hash, User, BookOpen } from 'lucide-react';
import type { VolunteerCard } from '@/lib/api/services/volunteers.service';

// ── Design tokens ─────────────────────────────────────────────────────────────

const BORDER = '#E2E8F0';
const MUTED  = '#94A3B8';
const TEXT   = '#1E293B';

function roleChip(role: string) {
  const lower = role.toLowerCase();
  const isWingman = lower.includes('wingman');
  return {
    bg:  isWingman ? '#EFF6FF' : '#FFF7ED',
    fg:  isWingman ? '#1D4ED8' : '#C2410C',
  };
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

// ── DetailRow ──────────────────────────────────────────────────────────────────

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1.25 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: '8px',
          bgcolor: '#F8FAFC',
          border: `1px solid ${BORDER}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          mt: 0.125,
        }}
      >
        <Icon size={14} color={MUTED} strokeWidth={1.75} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '10px', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1, mb: 0.375 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: '13px', color: value ? TEXT : MUTED, fontStyle: value ? 'normal' : 'italic', wordBreak: 'break-all' }}>
          {value ?? '—'}
        </Typography>
      </Box>
    </Box>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface VolunteerDetailDrawerProps {
  volunteer: VolunteerCard | null;
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function VolunteerDetailDrawer({ volunteer, onClose }: VolunteerDetailDrawerProps) {
  const chip = volunteer ? roleChip(volunteer.userRole) : null;

  return (
    <Drawer
      anchor="right"
      open={Boolean(volunteer)}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 340,
          borderLeft: `1.5px solid ${BORDER}`,
          boxShadow: '-4px 0 24px rgba(0,0,0,0.06)',
        },
      }}
    >
      {volunteer && (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

          {/* ── Header ── */}
          <Box
            sx={{
              px: 2.5,
              pt: 2.5,
              pb: 2,
              borderBottom: `1px solid ${BORDER}`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
            }}
          >
            {/* Avatar */}
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                bgcolor: '#EFF6FF',
                border: '2px solid #BFDBFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: '15px',
                fontWeight: 800,
                color: '#2563EB',
              }}
            >
              {initials(volunteer.userDisplayName)}
            </Box>

            {/* Name + role + close */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '15px', fontWeight: 700, color: TEXT, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {volunteer.userDisplayName}
              </Typography>
              <Box
                sx={{
                  mt: 0.5,
                  px: 1,
                  py: 0.25,
                  borderRadius: '5px',
                  bgcolor: chip!.bg,
                  display: 'inline-block',
                }}
              >
                <Typography sx={{ fontSize: '10px', fontWeight: 600, color: chip!.fg }}>
                  {volunteer.userRole}
                </Typography>
              </Box>
            </Box>

            <IconButton
              size="small"
              onClick={onClose}
              sx={{ mt: -0.25, color: MUTED, flexShrink: 0, '&:hover': { bgcolor: '#F1F5F9', color: '#475569' } }}
            >
              <X size={15} />
            </IconButton>
          </Box>

          {/* ── Detail rows ── */}
          <Box sx={{ px: 2.5, py: 1, overflowY: 'auto', flex: 1 }}>

            {/* Teaching badge */}
            <Box
              sx={{
                py: 1.25,
                px: 1.5,
                borderRadius: '8px',
                bgcolor: volunteer.activeSlotClassCount > 0 ? '#F0FDF4' : '#F8FAFC',
                border: `1px solid ${volunteer.activeSlotClassCount > 0 ? '#BBF7D0' : BORDER}`,
                mb: 2,
                mt: 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <BookOpen size={13} color={volunteer.activeSlotClassCount > 0 ? '#16A34A' : MUTED} strokeWidth={1.75} />
              <Typography
                sx={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: volunteer.activeSlotClassCount > 0 ? '#15803D' : MUTED,
                }}
              >
                {volunteer.activeSlotClassCount > 0
                  ? `Teaching ${volunteer.activeSlotClassCount} class${volunteer.activeSlotClassCount !== 1 ? 'es' : ''}`
                  : 'Not currently teaching'}
              </Typography>
            </Box>

            <Divider sx={{ mb: 1, borderColor: BORDER }} />

            <DetailRow icon={Hash}   label="User ID"  value={String(volunteer.userId)} />
            <Divider sx={{ borderColor: BORDER }} />
            <DetailRow icon={Mail}   label="Email"    value={volunteer.email} />
            <Divider sx={{ borderColor: BORDER }} />
            <DetailRow icon={User}   label="Login"    value={volunteer.userLogin} />
            <Divider sx={{ borderColor: BORDER }} />
            <DetailRow icon={Phone}  label="Contact"  value={volunteer.contact} />
            <Divider sx={{ borderColor: BORDER }} />
            <DetailRow icon={MapPin} label="City"     value={volunteer.city} />
            <Divider sx={{ borderColor: BORDER }} />
            <DetailRow icon={MapPin} label="State"    value={volunteer.state} />
          </Box>
        </Box>
      )}
    </Drawer>
  );
}
