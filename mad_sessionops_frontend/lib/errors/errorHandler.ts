import * as Sentry from "@sentry/nextjs";
import { showApiError, showError } from "../toast/toast";
import type { ApiError } from "../api/types";

/**
 * ============================================
 * ERROR HANDLER
 * ============================================
 *
 * Centralized error handling logic.
 */

/**
 * Error Handler Options
 */
interface ErrorHandlerOptions {
  showToast?: boolean; // Show toast notification
  logError?: boolean; // Log to console
  reportError?: boolean; // Report to error tracking service
  fallbackMessage?: string; // Custom fallback message
  onError?: (error: ApiError) => void; // Custom error callback
}

/**
 * Handle API Error
 *
 * Central function to handle all API errors.
 */
export function handleApiError(error: ApiError, options: ErrorHandlerOptions = {}) {
  const {
    showToast = true,
    logError = true,
    reportError = false,
    fallbackMessage = "An error occurred",
    onError,
  } = options;

  // Log error (development)
  if (logError && process.env.NODE_ENV === "development") {
    console.error("API Error:", error);
  }

  // Show toast notification
  if (showToast) {
    if (error.message) {
      showApiError(error);
    } else {
      showError(fallbackMessage);
    }
  }

  // Report error (production)
  if (reportError && process.env.NODE_ENV === "production") {
    reportErrorToService(error);
  }

  // Custom callback
  if (onError) {
    onError(error);
  }

  return error;
}

/**
 * Handle Validation Error
 */
export function handleValidationError(
  error: ApiError,
  setFieldErrors?: (errors: Record<string, string>) => void
) {
  if (error.code === "VALIDATION_ERROR" && error.errors) {
    // Set field errors in form
    if (setFieldErrors) {
      const fieldErrors: Record<string, string> = {};
      Object.entries(error.errors).forEach(([field, messages]) => {
        fieldErrors[field] = (messages as string[])[0];
      });
      setFieldErrors(fieldErrors);
    }

    // Show general error message
    showError(error.message || "Please fix the errors and try again.");
  } else {
    handleApiError(error);
  }
}

/**
 * Report Error to Service
 *
 * Send error to error tracking service (e.g., Sentry).
 */
function reportErrorToService(error: ApiError) {
  Sentry.captureException(error);
}

/**
 * Get Error Message
 *
 * Extracts user-friendly error message.
 */
export function getErrorMessage(error: ApiError | string): string {
  if (typeof error === "string") {
    return error;
  }

  if (error.message) {
    return error.message;
  }

  if (error.data?.message) {
    return error.data.message;
  }

  return "An unexpected error occurred";
}

/**
 * Is Network Error
 */
export function isNetworkError(error: ApiError): boolean {
  return error.code === "NETWORK_ERROR" || error.status === 0;
}

/**
 * Is Auth Error
 */
export function isAuthError(error: ApiError): boolean {
  return error.code === "UNAUTHORIZED" || error.status === 401;
}

/**
 * Is Validation Error
 */
export function isValidationError(error: ApiError): boolean {
  return error.code === "VALIDATION_ERROR" || error.status === 422;
}

/**
 * Is Server Error
 */
export function isServerError(error: ApiError): boolean {
  return error.code === "SERVER_ERROR" || error.status >= 500;
}
