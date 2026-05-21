'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Clock } from 'lucide-react';

interface Props {
  schoolId: number;
}

export function SlotListTab({ schoolId: _schoolId }: Props) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 320,
        gap: 1.5,
        px: 4,
        py: 6,
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: '12px',
          bgcolor: '#FFF7ED',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 0.5,
        }}
      >
        <Clock size={22} strokeWidth={1.5} color="#EA580C" />
      </Box>
      <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#1E293B' }}>
        No slots configured yet.
      </Typography>
      <Typography sx={{ fontSize: '14px', color: '#64748B', textAlign: 'center', maxWidth: 340 }}>
        Click &apos;Add Slot&apos; to create one.
      </Typography>
    </Box>
  );
}
