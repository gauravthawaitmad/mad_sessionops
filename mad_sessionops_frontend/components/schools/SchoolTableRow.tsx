'use client';

import { memo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { colors } from '@/config/design-tokens';
import type { SchoolListItem } from '@/lib/api/services/schools.service';

const GRID  = 'minmax(0, 2.4fr) 1fr 0.7fr 0.7fr 0.7fr 0.7fr';
const ROW_H = 64;

// ── Avatar ─────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#ef4444', '#06b6d4', '#84cc16',
];

function schoolAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function SchoolAvatar({ initials, name }: { initials: string; name: string }) {
  return (
    <Box
      sx={{
        width: 32,
        height: 32,
        borderRadius: '8px',
        bgcolor: schoolAvatarColor(name),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: colors.white,
        fontSize: '12px',
        fontWeight: 600,
      }}
    >
      {initials}
    </Box>
  );
}

// ── Numeric cell ───────────────────────────────────────────────────────────────

function NumCell({ value }: { value: number }) {
  return (
    <Typography
      sx={{
        fontSize: '14px',
        lineHeight: '20px',
        fontWeight: 500,
        fontFamily: '"JetBrains Mono", "Courier New", monospace',
        color: value === 0 ? colors.gray[400] : colors.gray[700],
        textAlign: 'right',
      }}
    >
      {value}
    </Typography>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────────

export const SchoolTableRow = memo(function SchoolTableRow({ school }: { school: SchoolListItem }) {
  const router = useRouter();

  function handleActivate() {
    router.push(`/schools/${school.partnerId}`);
  }

  return (
    <Box
      role="row"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleActivate(); }
      }}
      sx={{
        display: 'grid',
        gridTemplateColumns: GRID,
        gap: 1.5,
        px: 2,
        alignItems: 'center',
        height: ROW_H,
        borderBottom: `1px solid ${colors.gray[200]}`,
        cursor: 'pointer',
        '&:last-of-type': { borderBottom: 'none' },
        '&:hover': { bgcolor: colors.gray[50] },
        '&:focus-visible': { outline: `2px solid #3b82f6`, outlineOffset: '-2px' },
      }}
    >
      {/* Col 1: School name + Community Organizer */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        <SchoolAvatar initials={school.initials} name={school.name} />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: '14px',
              fontWeight: 500,
              color: colors.gray[900],
              lineHeight: '20px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {school.name}
          </Typography>
          {school.coName && (
            <Typography
              sx={{
                fontSize: '12px',
                color: colors.gray[400],
                lineHeight: '18px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {school.coName}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Col 2: City */}
      <Typography sx={{ fontSize: '13px', color: colors.gray[500] }}>
        {school.city ?? '—'}
      </Typography>

      {/* Col 3: Classes */}
      <NumCell value={school.classesCount} />

      {/* Col 4: Children */}
      <NumCell value={school.childrenCount} />

      {/* Col 5: Volunteers */}
      <NumCell value={school.volunteersCount} />

      {/* Col 6: Assignments */}
      <NumCell value={school.assignmentsCount} />
    </Box>
  );
});
