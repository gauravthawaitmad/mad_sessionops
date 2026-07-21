"use client";

import { GoogleOAuthProvider as GoogleProvider } from "@react-oauth/google";
import { ReactNode } from "react";

/**
 * ============================================
 * GOOGLE OAUTH PROVIDER
 * ============================================
 *
 * Wraps app with Google OAuth context
 */

interface GoogleOAuthProviderProps {
  children: ReactNode;
}

export function GoogleOAuthProvider({ children }: GoogleOAuthProviderProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    console.error("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID");
    return <>{children}</>;
  }

  return <GoogleProvider clientId={clientId}>{children}</GoogleProvider>;
}
