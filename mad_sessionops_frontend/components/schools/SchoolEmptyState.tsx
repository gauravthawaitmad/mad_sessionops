'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { BookOpen } from 'lucide-react';
import { colors } from '@/config/design-tokens';

export function SchoolEmptyState() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 4,
        textAlign: 'center',
      }}
    >
      <BookOpen size={32} color={colors.gray[500]} strokeWidth={1.5} />
      <Typography
        variant="h5"
        sx={{ mt: 2, mb: 1, fontWeight: 600, color: colors.gray[900], fontSize: '18px' }}
      >
        No schools assigned yet
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: colors.gray[500], maxWidth: 380, lineHeight: 1.6, mb: 3 }}
      >
        You&apos;ll see your schools here once an admin assigns them to your account.
        Reach out to your MAD coordinator if you think this is wrong.
      </Typography>
      <Button
        variant="outlined"
        size="small"
        href="mailto:technology@makeadiff.in"
        sx={{ textTransform: 'none', borderColor: colors.gray[300], color: colors.gray[700] }}
      >
        Contact admin
      </Button>
    </Box>
  );
}
