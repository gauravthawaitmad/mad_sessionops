import toast from "react-hot-toast";

/**
 * ============================================
 * TOAST UTILITIES
 * ============================================
 *
 * Centralized toast notification functions.
 */

/**
 * Show Success Toast
 */
export function showSuccess(message: string, duration?: number) {
  toast.success(message, { duration });
}

/**
 * Show Error Toast
 */
export function showError(message: string, duration?: number) {
  toast.error(message, { duration });
}

/**
 * Show Info Toast
 */
export function showInfo(message: string, duration?: number) {
  toast(message, {
    duration,
    icon: "ℹ️",
  });
}

/**
 * Show Warning Toast
 */
export function showWarning(message: string, duration?: number) {
  toast(message, {
    duration,
    icon: "⚠️",
    style: {
      background: "#f59e0b",
      color: "#fff",
    },
  });
}

/**
 * Show Loading Toast
 */
export function showLoading(message: string = "Loading...") {
  return toast.loading(message);
}

/**
 * Dismiss Toast
 */
export function dismissToast(toastId: string) {
  toast.dismiss(toastId);
}

/**
 * Dismiss All Toasts
 */
export function dismissAll() {
  toast.dismiss();
}

/**
 * Show Promise Toast
 *
 * Automatically shows loading, success, or error based on promise result.
 */
export function showPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: any) => string);
  }
) {
  return toast.promise(promise, messages);
}

/**
 * Show API Error
 *
 * Formats API errors from interceptor.
 * AUTH_ERROR (wrong credentials, bad token) is intentionally silent here
 * because those errors are already displayed inline inside the relevant form.
 */
export function showApiError(error: any) {
  // Plain string — surface it directly (e.g. from rejectWithValue in a thunk)
  if (typeof error === "string") {
    showError(error);
    return;
  }

  if (error.code === "NETWORK_ERROR") {
    showError("No internet connection. Please check your network.");
  } else if (error.code === "AUTH_ERROR") {
    // Inline form already shows the message — no toast needed.
  } else if (error.code === "SESSION_EXPIRED" || error.code === "UNAUTHORIZED") {
    // User is being redirected — no toast needed.
  } else if (error.code === "FORBIDDEN") {
    showError("You don't have permission to perform this action.");
  } else if (error.code === "NOT_FOUND") {
    showError("The requested resource was not found.");
  } else if (error.code === "VALIDATION_ERROR") {
    showError(error.message || "Please check your input and try again.");
  } else if (error.code === "RATE_LIMIT_EXCEEDED") {
    showError(error.message || "Too many requests. Please slow down.");
  } else if (error.code === "SERVER_ERROR") {
    showError("Server error. Please try again later.");
  } else {
    showError(error.message || "An unexpected error occurred.");
  }
}

/**
 * Show Validation Errors
 *
 * Shows field-level validation errors.
 */
export function showValidationErrors(errors: Record<string, string[]>) {
  const errorMessages = Object.entries(errors)
    .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
    .join("\n");

  showError(errorMessages, 6000);
}

/**
 * Confirm Action
 *
 * Shows confirmation toast with action buttons.
 */
export function confirmAction(message: string, onConfirm: () => void, onCancel?: () => void) {
  toast(
    (t) => (
      <div>
        <p style={{ marginBottom: "12px" }}>{message}</p>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => {
              onConfirm();
              toast.dismiss(t.id);
            }}
            style={{
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Confirm
          </button>
          <button
            onClick={() => {
              onCancel?.();
              toast.dismiss(t.id);
            }}
            style={{
              background: "#6b7280",
              color: "#fff",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    ),
    { duration: 10000 }
  );
}
