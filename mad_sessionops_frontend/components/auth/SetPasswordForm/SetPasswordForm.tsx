'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Box, Stack, IconButton } from '@mui/material';
import Typography from '@mui/material/Typography';
import NextLink from 'next/link';
import { Eye, EyeOff, KeyRound, CheckCircle2, ArrowRight } from 'lucide-react';
import { passwordSchema } from '../validation/authValidation';
import { Input, Button, Alert, Label } from '@/components/ui';
import services from '@/lib/api/services/index';
import { colors } from '@/config/design-tokens';

const setPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof setPasswordSchema>;

const REDIRECT_SECONDS = 5;

export function SetPasswordForm() {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [apiError, setApiError] = useState<string | undefined>();
  const [succeeded, setSucceeded] = useState(false);
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(setPasswordSchema),
    mode: 'onBlur',
  });

  useEffect(() => {
    if (!succeeded) return;
    const interval = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(interval);
          router.push('/login');
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [succeeded, router]);

  const onSubmit = async (data: FormData) => {
    setApiError(undefined);
    try {
      await services.auth.setPassword(data.newPassword);
      setSucceeded(true);
    } catch (err: any) {
      setApiError(err?.message || 'Failed to set password. Please try again.');
    }
  };

  if (succeeded) {
    return (
      <Box sx={{ textAlign: 'center', py: 1 }}>
        {/* Icon */}
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            bgcolor: colors.success[50],
            border: `2px solid ${colors.success[200]}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2.5,
          }}
        >
          <CheckCircle2 size={26} strokeWidth={1.75} color={colors.success[600]} />
        </Box>

        {/* Heading */}
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: colors.gray[900], mb: 0.75 }}>
          Password set successfully!
        </Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: colors.gray[500], mb: 3, lineHeight: 1.6 }}>
          You can now sign in with your email and new password.
        </Typography>

        {/* Countdown bar */}
        <Box
          sx={{
            height: 3,
            borderRadius: 2,
            bgcolor: colors.gray[100],
            overflow: 'hidden',
            mb: 2,
            position: 'relative',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: colors.success[500],
              borderRadius: 2,
              transformOrigin: 'left',
              transform: `scaleX(${countdown / REDIRECT_SECONDS})`,
              transition: 'transform 1s linear',
            }}
          />
        </Box>

        <Typography sx={{ fontSize: '0.75rem', color: colors.gray[400], mb: 3 }}>
          Redirecting to sign in in{' '}
          <Box component="span" sx={{ fontWeight: 600, color: colors.gray[600] }}>
            {countdown}s
          </Box>
        </Typography>

        {/* Manual sign-in link */}
        <Box
          component={NextLink}
          href="/login"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            fontSize: '0.875rem',
            fontWeight: 600,
            color: colors.gray[900],
            textDecoration: 'none',
            px: 2.5,
            py: 1,
            border: `1px solid ${colors.gray[200]}`,
            borderRadius: 1.5,
            '&:hover': { bgcolor: colors.gray[50], borderColor: colors.gray[300] },
          }}
        >
          Sign in now
          <ArrowRight size={14} strokeWidth={2} />
        </Box>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ width: '100%' }}>
      {apiError && (
        <Alert severity="error" onClose={() => setApiError(undefined)} closable sx={{ mb: 2 }}>
          {apiError}
        </Alert>
      )}

      <Stack spacing={2}>
        <Box>
          <Label htmlFor="newPassword" required sx={{ fontSize: '0.8125rem', mb: 0.5 }}>
            New password
          </Label>
          <Input
            id="newPassword"
            type={showNew ? 'text' : 'password'}
            size="small"
            placeholder="••••••••"
            {...register('newPassword')}
            error={errors.newPassword?.message}
            disabled={isSubmitting}
            endIcon={
              <IconButton onClick={() => setShowNew(!showNew)} edge="end" size="small" tabIndex={-1} sx={{ color: colors.gray[400] }}>
                {showNew ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
              </IconButton>
            }
          />
        </Box>

        <Box>
          <Label htmlFor="confirmPassword" required sx={{ fontSize: '0.8125rem', mb: 0.5 }}>
            Confirm password
          </Label>
          <Input
            id="confirmPassword"
            type={showConfirm ? 'text' : 'password'}
            size="small"
            placeholder="••••••••"
            {...register('confirmPassword')}
            error={errors.confirmPassword?.message}
            disabled={isSubmitting}
            endIcon={
              <IconButton onClick={() => setShowConfirm(!showConfirm)} edge="end" size="small" tabIndex={-1} sx={{ color: colors.gray[400] }}>
                {showConfirm ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
              </IconButton>
            }
          />
        </Box>

        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="medium"
          loading={isSubmitting}
          endIcon={!isSubmitting && <KeyRound size={16} strokeWidth={1.5} />}
          sx={{
            py: 1.125,
            fontSize: '0.875rem',
            fontWeight: 600,
            textTransform: 'none',
            boxShadow: 'none',
            bgcolor: colors.gray[900],
            '&:hover': { bgcolor: colors.gray[800], boxShadow: 'none' },
            mt: 0.5,
          }}
        >
          Set password
        </Button>
      </Stack>
    </Box>
  );
}
