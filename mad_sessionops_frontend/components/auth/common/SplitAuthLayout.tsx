'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Image from 'next/image';
import NextLink from 'next/link';
import { BookOpen, Users, Calendar, CheckCircle2, ArrowLeft } from 'lucide-react';
import { colors } from '@/config/design-tokens';
import { ReactNode } from 'react';

interface SplitAuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
}

const features = [
  { icon: BookOpen, label: 'Manage class sessions and school partnerships' },
  { icon: Users, label: 'Track COs, volunteers, and children' },
  { icon: Calendar, label: 'Schedule and coordinate teaching slots' },
];

export function SplitAuthLayout({ children, title, subtitle, backHref, backLabel }: SplitAuthLayoutProps) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex' }}>

      {/* ── LEFT — brand panel ────────────────────────────────────────────── */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          width: '44%',
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 5,
          background: `linear-gradient(160deg, ${colors.brand.red[600]} 0%, ${colors.brand.red[500]} 100%)`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* dot-grid overlay */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: 0.06,
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='%23ffffff'/%3E%3C/svg%3E\")",
            backgroundSize: '20px 20px',
          }}
        />

        {/* wordmark */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, position: 'relative', zIndex: 1 }}>
          <Image
            src="/images/mad_logo.png"
            alt="MAD logo"
            width={34}
            height={34}
            style={{ borderRadius: 6 }}
          />
          <Box>
            <Typography
              component="span"
              sx={{ fontWeight: 700, fontSize: '0.9375rem', color: '#fff', letterSpacing: '-0.01em', display: 'block' }}
            >
              Session-Ops
            </Typography>
            <Typography
              component="span"
              sx={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              Make a Difference
            </Typography>
          </Box>
        </Box>

        {/* center content */}
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2.5,
              bgcolor: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
            }}
          >
            <BookOpen size={26} strokeWidth={1.5} color="#fff" />
          </Box>

          <Typography
            variant="h4"
            sx={{ fontWeight: 700, color: '#fff', mb: 1.5, lineHeight: 1.2, fontSize: '1.625rem' }}
          >
            School Operations,
            <br />
            Simplified
          </Typography>

          <Typography
            sx={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.75)', mb: 4, maxWidth: 320, lineHeight: 1.6 }}
          >
            The internal platform MAD uses to coordinate city officers,
            volunteers, and children across every partner school.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
            {features.map(({ icon: Icon, label }) => (
              <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <CheckCircle2 size={16} strokeWidth={1.75} color="rgba(255,255,255,0.85)" />
                <Typography sx={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Typography sx={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.45)', position: 'relative', zIndex: 1 }}>
          © {new Date().getFullYear()} Make A Difference (MAD)
        </Typography>
      </Box>

      {/* ── RIGHT — form panel ────────────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 3, sm: 5 },
          bgcolor: colors.gray[50],
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 380 }}>

          {/* Logo — visible on all screen sizes */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 4 }}>
            <Image src="/images/mad_logo.png" alt="MAD logo" width={32} height={32} style={{ borderRadius: 6 }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', color: colors.gray[900], lineHeight: 1.2 }}>
                Session-Ops
              </Typography>
              <Typography sx={{ fontSize: '0.6875rem', color: colors.gray[400], letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Make a Difference
              </Typography>
            </Box>
          </Box>

          {/* Back link */}
          {backHref && (
            <Box
              component={NextLink}
              href={backHref}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                mb: 2,
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: colors.gray[500],
                textDecoration: 'none',
                '&:hover': { color: colors.gray[800] },
              }}
            >
              <ArrowLeft size={14} strokeWidth={2} />
              {backLabel ?? 'Back'}
            </Box>
          )}

          {/* Card */}
          <Box
            sx={{
              bgcolor: '#fff',
              border: `1px solid ${colors.gray[200]}`,
              borderRadius: 2.5,
              p: { xs: 3, sm: 3.5 },
              boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05), 0 1px 2px -1px rgba(0,0,0,0.04)',
            }}
          >
            {/* Heading */}
            <Box mb={2.5}>
              <Typography
                sx={{ fontWeight: 700, fontSize: '1.125rem', color: colors.gray[900], mb: 0.5, lineHeight: 1.3 }}
              >
                {title}
              </Typography>
              {subtitle && (
                <Typography sx={{ fontSize: '0.8125rem', color: colors.gray[500], lineHeight: 1.5 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>

            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
