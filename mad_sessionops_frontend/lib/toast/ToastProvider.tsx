"use client";

import { Toaster } from "react-hot-toast";

/**
 * ============================================
 * TOAST PROVIDER
 * ============================================
 *
 * Wraps app to enable toast notifications.
 */

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      gutter={8}
      toastOptions={{
        // Default options
        duration: 4000,
        style: {
          background: "#363636",
          color: "#fff",
          padding: "16px",
          borderRadius: "8px",
          fontSize: "14px",
        },

        // Success: 4s auto-dismiss (UI_REFERENCE)
        success: {
          duration: 4000,
          iconTheme: {
            primary: "#10b981",
            secondary: "#fff",
          },
        },

        // Error: manual-dismiss only (UI_REFERENCE)
        error: {
          duration: Infinity,
          iconTheme: {
            primary: "#ef4444",
            secondary: "#fff",
          },
        },

        // Loading style
        loading: {
          iconTheme: {
            primary: "#3b82f6",
            secondary: "#fff",
          },
        },
      }}
    />
  );
}
