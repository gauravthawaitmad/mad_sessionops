'use client';

import {
  Box,
  Card,
  CardContent,
  Container,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';
import { ReactNode } from 'react';

/**
 * ============================================
 * AUTH LAYOUT
 * ============================================
 *
 * Shared layout for all authentication pages.
 *
 * Features:
 * - Centered card design
 * - Gradient background
 * - Logo and branding
 * - Responsive
 * - Footer
 */

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        // Gradient background
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${theme.palette.background.default} 100%)`,
      }}
    >
      <Container component="main" maxWidth="xs">
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            py: 4,
          }}
        >
          {/* ============================================ */}
          {/* LOGO & BRANDING */}
          {/* ============================================ */}
          <Box textAlign="center" mb={4}>
            {/* Logo */}
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 2,
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                mb: 2,
                boxShadow: theme.shadows[4],
                transition: 'transform 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.05)',
                },
              }}
            >
              <Typography
                variant="h4"
                component="div"
                sx={{
                  color: 'white',
                  fontWeight: 'bold',
                }}
              >
                M
              </Typography>
            </Box>

            {/* Platform Name */}
            <Typography
              variant="h5"
              component="h1"
              fontWeight="bold"
              color="text.primary"
              gutterBottom
            >
              MAD Platform
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Management & Development
            </Typography>
          </Box>

          {/* ============================================ */}
          {/* MAIN CARD */}
          {/* ============================================ */}
          <Card
            elevation={4}
            sx={{
              borderRadius: 3,
              overflow: 'hidden',
              boxShadow: theme.shadows[8],
            }}
          >
            <CardContent
              sx={{
                p: 4,
                '&:last-child': {
                  pb: 4,
                },
              }}
            >
              {/* Title & Subtitle */}
              <Box mb={3}>
                <Typography
                  variant="h5"
                  component="h2"
                  fontWeight={600}
                  gutterBottom
                  textAlign="center"
                >
                  {title}
                </Typography>
                {subtitle && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    textAlign="center"
                  >
                    {subtitle}
                  </Typography>
                )}
              </Box>

              {/* Content (Form) */}
              {children}
            </CardContent>
          </Card>

          {/* ============================================ */}
          {/* FOOTER */}
          {/* ============================================ */}
          <Box textAlign="center" mt={3}>
            <Typography variant="caption" color="text.secondary">
              © {new Date().getFullYear()} MAD Platform. All rights reserved.
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
