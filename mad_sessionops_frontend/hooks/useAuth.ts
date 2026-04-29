'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/lib/redux';
import {
  loginUser,
  logoutUser,
  registerUser,
  selectIsAuthenticated,
  selectIsLoading,
  selectError,
  selectUser,
  selectIsInitialized,
  clearError,
} from '@/lib/redux/features/auth/authSlice';
import { showSuccess, showApiError } from '@/lib/toast/toast';
import type { LoginFormData, RegisterFormData } from '@/components/auth/validation/authValidation';
import { loginWithGoogleToken } from '@/lib/redux/features/auth/authSlice';

/**
 * ============================================
 * USE AUTH HOOK
 * ============================================
 *
 * Centralized authentication operations.
 *
 * Features:
 * - Login/logout/register
 * - User state management
 * - Error handling
 * - Toast notifications
 * - Automatic redirects
 */

export function useAuth() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  // Selectors
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isLoading = useAppSelector(selectIsLoading);
  const error = useAppSelector(selectError);
  const user = useAppSelector(selectUser);
  const isInitialized = useAppSelector(selectIsInitialized);

  /**
   * Login
   */
  const login = useCallback(async (data: LoginFormData) => {
    try {
      dispatch(clearError());

      await dispatch(loginUser({
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe,
      })).unwrap();

      showSuccess('Welcome back!');
      router.push('/dashboard');

      return { success: true };
    } catch (err: any) {
      showApiError(err);
      return { success: false, error: err };
    }
  }, [dispatch, router]);

  /**
   * Login with Google
   */
  const loginWithGoogle = useCallback(async (googleToken: string) => {
    try {
      dispatch(clearError());

      await dispatch(loginWithGoogleToken(googleToken)).unwrap();
      showSuccess('Welcome back!');
      router.push('/dashboard');

      return { success: true };
    } catch (err: any) {
      showApiError(err);
      return { success: false, error: err };
    }
  }, [dispatch, router]);

  /**
   * Register
   */
  const register = useCallback(async (data: RegisterFormData) => {
    try {
      dispatch(clearError());

      await dispatch(registerUser({
        name: data.name,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
        acceptTerms: data.acceptTerms,
        phone: data.phone,
      })).unwrap();

      showSuccess('Account created successfully!');
      router.push('/dashboard');

      return { success: true };
    } catch (err: any) {
      showApiError(err);
      return { success: false, error: err };
    }
  }, [dispatch, router]);

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    try {
      await dispatch(logoutUser()).unwrap();
      showSuccess('Logged out successfully');
      router.push('/login');
      return { success: true };
    } catch (err: any) {
      console.error('Logout error:', err);
      router.push('/login');
      return { success: false, error: err };
    }
  }, [dispatch, router]);

  /**
   * Reset Error
   */
  const resetError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  return {
    // State
    isAuthenticated,
    isLoading,
    isInitialized,
    error,
    user,

    // Actions
    login,
    loginWithGoogle,
    register,
    logout,
    resetError,
  };
}
