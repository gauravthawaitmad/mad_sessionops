"use client";

import { useState, useCallback } from "react";
import { loginSchema, type LoginFormData } from "../validation/authValidation";
import { useAuth } from "@/hooks/useAuth";

/**
 * ============================================
 * USE LOGIN FORM HOOK
 * ============================================
 *
 * Handles login form logic.
 *
 * Features:
 * - Form state management
 * - Field validation
 * - Form submission
 * - Error handling
 */

export function useLoginForm() {
  const { login, isLoading, error: authError, resetError } = useAuth();

  // Form state
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
    rememberMe: false,
  });

  // Field errors
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({});

  // Touched fields
  const [touchedFields, setTouchedFields] = useState<Set<keyof LoginFormData>>(new Set());

  /**
   * Handle field change
   */
  const handleChange = useCallback(
    (field: keyof LoginFormData, value: string | boolean) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));

      // Clear field error
      setFieldErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));

      // Clear auth error
      resetError();
    },
    [resetError]
  );

  /**
   * Handle field blur
   */
  const handleBlur = useCallback(
    (field: keyof LoginFormData) => {
      // Mark as touched
      setTouchedFields((prev) => new Set(prev).add(field));

      // Validate field
      const fieldSchema = loginSchema.shape[field];
      const result = fieldSchema.safeParse(formData[field]);

      if (!result.success) {
        setFieldErrors((prev) => ({
          ...prev,
          [field]: result.error.issues[0]?.message,
        }));
      }
    },
    [formData]
  );

  /**
   * Validate entire form
   */
  const validate = useCallback((): boolean => {
    const result = loginSchema.safeParse(formData);

    if (!result.success) {
      const errors: Partial<Record<keyof LoginFormData, string>> = {};

      result.error.issues.forEach((err) => {
        const field = err.path[0] as keyof LoginFormData;
        if (!errors[field]) {
          errors[field] = err.message;
        }
      });

      setFieldErrors(errors);
      setTouchedFields(new Set(["email", "password", "rememberMe"]));

      return false;
    }

    setFieldErrors({});
    return true;
  }, [formData]);

  /**
   * Handle form submit
   */
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
      }

      // Validate
      if (!validate()) {
        return { success: false };
      }
      // Submit
      const result = await login(formData);

      return result;
    },
    [formData, validate, login]
  );

  /**
   * Reset form
   */
  const resetForm = useCallback(() => {
    setFormData({
      email: "",
      password: "",
      rememberMe: false,
    });
    setFieldErrors({});
    setTouchedFields(new Set());
    resetError();
  }, [resetError]);

  /**
   * Get field error (only if touched)
   */
  const getFieldError = useCallback(
    (field: keyof LoginFormData): string | undefined => {
      if (!touchedFields.has(field)) {
        return undefined;
      }
      return fieldErrors[field];
    },
    [fieldErrors, touchedFields]
  );

  return {
    // Form state
    formData,
    fieldErrors,
    touchedFields,
    isLoading,
    authError,

    // Handlers
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,

    // Utilities
    getFieldError,
    isValid: Object.keys(fieldErrors).length === 0,
  };
}
