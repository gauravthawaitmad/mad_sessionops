'use client';

import {
  Box,
  Link as MuiLink,
  Typography,
  IconButton,
  Divider,
  Stack,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
} from '@mui/icons-material';
import Link from 'next/link';
import { useState } from 'react';
import { useLoginForm } from './useLoginForm';
import { Input, Button, Checkbox, Alert, Label } from '@/components/ui';
import { GoogleLoginButton } from '../common/GoogleLoginButton';

export function LoginForm() {
  const {
    formData,
    isLoading,
    authError,
    handleChange,
    handleBlur,
    handleSubmit,
    getFieldError,
  } = useLoginForm();

  const [showPassword, setShowPassword] = useState(false);

  const emailError = getFieldError('email');
  const passwordError = getFieldError('password');

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      noValidate
      sx={{ width: '100%' }}
    >
      {/* Error Alert */}
      {authError && (
        <Alert severity="error" closable sx={{ mb: 3 }}>
          {authError}
        </Alert>
      )}

      <Stack spacing={2.5}>
        {/* Email Field */}
        <Box>
          <Label htmlFor="email" required>
            Email Address
          </Label>
          <Input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            onBlur={() => handleBlur('email')}
            error={emailError}
            disabled={isLoading}
            startIcon={<Email sx={{ color: 'action.active' }} />}
          />
        </Box>

        {/* Password Field */}
        <Box>
          <Label htmlFor="password" required>
            Password
          </Label>
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            onBlur={() => handleBlur('password')}
            error={passwordError}
            disabled={isLoading}
            startIcon={<Lock sx={{ color: 'action.active' }} />}
            endIcon={
              <IconButton
                onClick={() => setShowPassword(!showPassword)}
                edge="end"
                size="small"
                sx={{ color: 'action.active' }}
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            }
          />
        </Box>

        {/* Remember Me & Forgot Password */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Checkbox
            label="Remember me"
            checked={formData.rememberMe || false}
            onChange={(e) => handleChange('rememberMe', e.target.checked)}
            disabled={isLoading}
          />

          <MuiLink
            component={Link}
            href="/forgot-password"
            variant="body2"
            sx={{
              fontWeight: 500,
              color: 'primary.main',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            Forgot password?
          </MuiLink>
        </Box>

        {/* Login Button */}
        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          loading={isLoading}
          sx={{
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 600,
            textTransform: 'none',
            boxShadow: 2,
            '&:hover': {
              boxShadow: 4,
            },
          }}
        >
          Login
        </Button>

        {/* Divider */}
        <Divider sx={{ my: 1 }}>
          <Typography variant="caption" color="text.secondary">
            OR
          </Typography>
        </Divider>

        {/* ✅ Google Login Button */}
        <GoogleLoginButton />

        {/* Register Link */}
        {/* <Box textAlign="center" mt={2}>
          <Typography variant="body2" color="text.secondary">
            Don't have an account?{' '}
            <MuiLink
              component={Link}
              href="/register"
              sx={{
                fontWeight: 600,
                color: 'primary.main',
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              Sign up for free
            </MuiLink>
          </Typography>
        </Box> */}
      </Stack>
    </Box>
  );
}
