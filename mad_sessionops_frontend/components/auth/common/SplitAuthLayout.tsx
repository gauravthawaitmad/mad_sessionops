'use client';

import { Box, Container, Typography, Paper, useTheme, alpha } from '@mui/material';
import { ReactNode } from 'react';
import Image from 'next/image';

/**
 * ============================================
 * SPLIT AUTH LAYOUT
 * ============================================
 *
 * Modern split-screen layout for auth pages.
 * Left: Image/Illustration
 * Right: Form
 */

interface SplitAuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  imageSrc?: string;
  imageAlt?: string;
}

export function SplitAuthLayout({
  children,
  title,
  subtitle,
  imageSrc = '/images/mad_logo.png', // ✅ Correct path
  imageAlt = 'MAD Platform',
}: SplitAuthLayoutProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        bgcolor: 'background.default',
      }}
    >
      {/* ============================================ */}
      {/* LEFT SIDE - IMAGE */}
      {/* ============================================ */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          width: '50%',
          position: 'relative',
          bgcolor: 'primary.main',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          p: 4,
          background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
        }}
      >
        {/* Overlay Pattern */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: 0.1,
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }}
        />

        {/* Logo at Top Left */}
        <Box
          sx={{
            position: 'absolute',
            top: 40,
            left: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            zIndex: 1,
          }}
        >
          {/* ✅ Using Next.js Image component */}
          <Image
            src="/images/mad_logo.png"
            alt="MAD Platform Logo"
            width={48}
            height={48}
            style={{ borderRadius: 8 }}
          />
          <Typography variant="h6" fontWeight="bold" color="white">
            MAD Platform
          </Typography>
        </Box>

        {/* Center Content */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            maxWidth: 500,
            height: 400,
            zIndex: 1,
          }}
        >
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              textAlign: 'center',
            }}
          >
            {/* Large Logo in Center (Optional) */}
            <Box sx={{ mb: 4 }}>
              <Image
                src="/images/mad_logo.png"
                alt="MAD Platform"
                width={120}
                height={120}
                style={{ borderRadius: 16 }}
              />
            </Box>

            <Typography variant="h3" fontWeight="bold" gutterBottom>
              Welcome to MAD
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9, maxWidth: 400 }}>
              Management & Development Platform for modern teams
            </Typography>

            {/* Features List */}
            <Box sx={{ mt: 4, textAlign: 'left' }}>
              {[
                '✨ Easy to use interface',
                '🚀 Fast and reliable',
                '🔒 Secure by default',
              ].map((feature, index) => (
                <Typography
                  key={index}
                  variant="body1"
                  sx={{ mb: 1.5, opacity: 0.9 }}
                >
                  {feature}
                </Typography>
              ))}
            </Box>
          </Box>
        </Box>

        {/* Footer Text */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 40,
            left: 0,
            right: 0,
            textAlign: 'center',
            color: 'white',
            opacity: 0.7,
          }}
        >
          <Typography variant="caption">
            © 2024 MAD Platform. All rights reserved.
          </Typography>
        </Box>
      </Box>

      {/* ============================================ */}
      {/* RIGHT SIDE - FORM */}
      {/* ============================================ */}
      <Box
        sx={{
          width: { xs: '100%', md: '50%' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4,
        }}
      >
        <Container maxWidth="xs">
          <Box sx={{ width: '100%' }}>
            {/* Mobile Logo (visible on small screens) */}
            <Box
              sx={{
                display: { xs: 'flex', md: 'none' },
                justifyContent: 'center',
                mb: 4,
              }}
            >
              <Image
                src="/images/mad_logo.png"
                alt="MAD Platform"
                width={56}
                height={56}
                style={{ borderRadius: 8 }}
              />
            </Box>

            {/* Title */}
            <Box mb={4}>
              <Typography
                variant="h4"
                fontWeight="bold"
                gutterBottom
                sx={{ color: 'text.primary' }}
              >
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="body1" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>

            {/* Form Content */}
            {children}
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
