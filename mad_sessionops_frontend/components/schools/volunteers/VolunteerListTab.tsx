'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { UserCheck } from 'lucide-react';

interface Props {
  schoolId: number;
}

export function VolunteerListTab({ schoolId: _schoolId }: Props) {
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
          bgcolor: '#F0FDF4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 0.5,
        }}
      >
        <UserCheck size={22} strokeWidth={1.5} color="#16A34A" />
      </Box>
      <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#1E293B' }}>
        Volunteers
      </Typography>
      <Typography sx={{ fontSize: '14px', color: '#64748B', textAlign: 'center', maxWidth: 340 }}>
        Volunteer list coming soon. This tab will show all volunteers auto-populated from Worknode for this school.
      </Typography>
    </Box>
  );
}
