"use client";

import { useEffect } from "react";
import { ReduxProvider } from "@/lib/redux";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/lib/toast/ToastProvider";
import { ErrorBoundary } from "@/lib/errors/ErrorBoundary";
import { NetworkStatus } from "@/lib/errors/networkStatus";
import { initializeGlobalErrorHandler } from "@/lib/errors/globalErrorHandler";
import { GoogleOAuthProvider } from "@/components/providers/GoogleOAuthProvider";

/**
 * ============================================
 * APP PROVIDERS
 * ============================================
 *
 * Wraps entire app with all necessary providers.
 *
 * Includes:
 * - Redux Provider (state management)
 * - Theme Provider (MUI theming)
 * - Error Boundary (React error catching)
 * - Toast Provider (notifications)
 * - Network Status (offline/online monitor)
 * - Global Error Handler (unhandled errors)
 */

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  // Initialize global error handler on mount
  useEffect(() => {
    initializeGlobalErrorHandler();
  }, []);

  return (
    <ErrorBoundary>
      <ReduxProvider>
        <ThemeProvider>
          {/* <GoogleOAuthProvider> */}
          {children}
          {/* </GoogleOAuthProvider> */}
          {/* Toast notifications */}
          <ToastProvider />

          {/* Network status banner */}
          <NetworkStatus />
        </ThemeProvider>
      </ReduxProvider>
    </ErrorBoundary>
  );
}
