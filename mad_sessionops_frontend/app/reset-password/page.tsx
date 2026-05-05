'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import NextLink from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { SplitAuthLayout } from '@/components/auth/common/SplitAuthLayout';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { colors } from '@/config/design-tokens';
import { AlertCircle, Clock, ArrowRight, ShieldAlert } from 'lucide-react';
import services from '@/lib/api/services/index';

type TokenReason = 'valid' | 'consumed' | 'superseded' | 'time_expired' | 'not_found';
type TokenState = 'loading' | TokenReason;

const REASON_CONFIG: Record<
  Exclude<TokenReason, 'valid'>,
  {
    icon: typeof AlertCircle;
    iconColor: string;
    iconBg: string;
    iconBorder: string;
    heading: string;
    body: string;
    cta: string;
    ctaHref: string;
  }
> = {
  time_expired: {
    icon: Clock,
    iconColor: colors.warning[600],
    iconBg: colors.warning[50],
    iconBorder: colors.warning[200],
    heading: 'Link expired',
    body: 'This link was valid for 30 minutes and that window has passed. Request a fresh one — it only takes a moment.',
    cta: 'Request a new link',
    ctaHref: '/forgot-password',
  },
  superseded: {
    icon: ShieldAlert,
    iconColor: colors.brand.red[600],
    iconBg: '#fef2f2',
    iconBorder: '#fecaca',
    heading: 'Newer link already sent',
    body: 'A more recent password-set link was requested and this one was automatically voided. Please check your inbox for the latest email, or request a new link.',
    cta: 'Request a new link',
    ctaHref: '/forgot-password',
  },
  consumed: {
    icon: AlertCircle,
    iconColor: colors.success[600],
    iconBg: colors.success[50],
    iconBorder: colors.success[200],
    heading: 'Link already used',
    body: 'This link has already been used to set a password. If that was you, sign in with your new password. If not, contact your administrator.',
    cta: 'Go to sign in',
    ctaHref: '/login',
  },
  not_found: {
    icon: AlertCircle,
    iconColor: colors.error[600],
    iconBg: colors.error[50],
    iconBorder: colors.error[200],
    heading: 'Invalid link',
    body: 'This reset link is not recognised. It may have been copied incorrectly. Request a new one.',
    cta: 'Request a new link',
    ctaHref: '/forgot-password',
  },
};

function TokenBlockedView({ reason }: { reason: Exclude<TokenReason, 'valid'> }) {
  const cfg = REASON_CONFIG[reason];
  const Icon = cfg.icon;

  return (
    <Box sx={{ textAlign: 'center', py: 1 }}>
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          bgcolor: cfg.iconBg,
          border: `2px solid ${cfg.iconBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mx: 'auto',
          mb: 2.5,
        }}
      >
        <Icon size={26} strokeWidth={1.75} color={cfg.iconColor} />
      </Box>

      <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: colors.gray[900], mb: 0.75 }}>
        {cfg.heading}
      </Typography>
      <Typography sx={{ fontSize: '0.8125rem', color: colors.gray[500], mb: 3.5, lineHeight: 1.7 }}>
        {cfg.body}
      </Typography>

      <Box
        component={NextLink}
        href={cfg.ctaHref}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          fontSize: '0.875rem',
          fontWeight: 600,
          color: colors.white,
          textDecoration: 'none',
          px: 3,
          py: 1.25,
          bgcolor: colors.gray[900],
          borderRadius: 1.5,
          '&:hover': { bgcolor: colors.gray[800] },
        }}
      >
        {cfg.cta}
        <ArrowRight size={14} strokeWidth={2} />
      </Box>
    </Box>
  );
}

function TokenLoadingView() {
  return (
    <Box sx={{ py: 3 }}>
      {[80, 100, 80].map((w, i) => (
        <Box
          key={i}
          sx={{
            height: i === 1 ? 38 : 14,
            borderRadius: 1,
            bgcolor: colors.gray[100],
            mb: i < 2 ? 2 : 0,
            width: `${w}%`,
            animation: 'pulse 1.5s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.5 },
            },
          }}
        />
      ))}
    </Box>
  );
}

const PAGE_TITLES: Record<TokenState, string> = {
  loading: 'Verifying link…',
  valid: 'Set a new password',
  time_expired: 'Link expired',
  superseded: 'Link no longer valid',
  consumed: 'Link already used',
  not_found: 'Invalid link',
};

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [tokenState, setTokenState] = useState<TokenState>('loading');

  useEffect(() => {
    if (!token) {
      setTokenState('not_found');
      return;
    }
    services.auth.validateResetToken(token)
      .then(({ valid, reason }) =>
        setTokenState(valid ? 'valid' : (reason as TokenReason) || 'not_found')
      )
      .catch(() => setTokenState('not_found'));
  }, [token]);

  return (
    <SplitAuthLayout
      title={PAGE_TITLES[tokenState]}
      subtitle={tokenState === 'valid' ? 'Choose a strong password for your Session-Ops account.' : undefined}
      backHref="/login"
      backLabel="Back to sign in"
    >
      {tokenState === 'loading' && <TokenLoadingView />}
      {tokenState === 'valid' && <ResetPasswordForm token={token} />}
      {tokenState !== 'loading' && tokenState !== 'valid' && (
        <TokenBlockedView reason={tokenState} />
      )}
    </SplitAuthLayout>
  );
}
