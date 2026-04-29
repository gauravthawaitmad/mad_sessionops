import { showError } from "../toast/toast";

/**
 * ============================================
 * GLOBAL ERROR HANDLER
 * ============================================
 *
 * Catches unhandled errors and promise rejections.
 */

/**
 * Initialize Global Error Handler
 */
export function initializeGlobalErrorHandler() {
  if (typeof window === "undefined") return;

  // Handle unhandled errors
  window.addEventListener("error", (event) => {
    console.error("Unhandled error:", event.error);

    // Show user-friendly message
    showError("An unexpected error occurred. Please refresh the page.");

    // Prevent default browser error handling
    event.preventDefault();
  });

  // Handle unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);

    // Show user-friendly message
    showError("An unexpected error occurred.");

    // Prevent default browser error handling
    event.preventDefault();
  });
}

/**
 * Remove Global Error Handler
 */
export function removeGlobalErrorHandler() {
  if (typeof window === "undefined") return;

  window.removeEventListener("error", () => {});
  window.removeEventListener("unhandledrejection", () => {});
}
