/**
 * ============================================
 * AUTH VALIDATION SCHEMAS
 * ============================================
 *
 * Centralized validation for all auth forms.
 * Uses Zod for schema validation.
 *
 * Used by:
 * - LoginForm
 * - RegisterForm
 * - ForgotPasswordForm
 * - ResetPasswordForm
 * - ChangePasswordForm
 */

import { z } from 'zod';

// ============================================
// SHARED FIELD SCHEMAS
// ============================================

/**
 * Email Schema
 * Reusable across all forms
 */
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email address')
  .max(255, 'Email is too long');

/**
 * Password Schema (Strong)
 * For registration and password changes
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

/**
 * Password Schema (Simple)
 * For login - less strict
 */
export const passwordLoginSchema = z
  .string()
  .min(1, 'Password is required');

/**
 * Name Schema
 */
export const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name is too long')
  .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces');

/**
 * Phone Schema
 */
export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number')
  .optional()
  .or(z.literal(''));

// ============================================
// FORM SCHEMAS
// ============================================

/**
 * Login Form Schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordLoginSchema,
  rememberMe: z.boolean().optional(),
});

/**
 * Register Form Schema
 */
export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: 'You must accept the terms and conditions',
    }),
    phone: phoneSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Forgot Password Schema
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/**
 * Reset Password Schema
 */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Change Password Schema
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

// ============================================
// TYPE EXPORTS
// ============================================

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Validate Single Field
 *
 * @param schema - Zod schema
 * @param value - Value to validate
 * @returns Validation result
 */
export function validateField<T extends z.ZodTypeAny>(
  schema: T,
  value: unknown
): { success: boolean; error?: string } {
  const result = schema.safeParse(value);

  if (result.success) {
    return { success: true };
  }

  return {
    success: false,
    error: result.error.issues[0]?.message || 'Validation failed',
  };
}

/**
 * Calculate Password Strength
 *
 * @param password - Password to check
 * @returns Strength score (0-4)
 */
export function calculatePasswordStrength(password: string): number {
  let strength = 0;

  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;

  return Math.min(strength, 4);
}

/**
 * Get Password Strength Label
 *
 * @param strength - Strength score (0-4)
 * @returns Label string
 */
export function getPasswordStrengthLabel(strength: number): string {
  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  return labels[strength] || 'Very Weak';
}

/**
 * Get Password Strength Color
 *
 * @param strength - Strength score (0-4)
 * @returns Color hex code
 */
export function getPasswordStrengthColor(strength: number): string {
  const colors = ['#f44336', '#ff9800', '#ffc107', '#4caf50', '#2196f3'];
  return colors[strength] || '#f44336';
}
