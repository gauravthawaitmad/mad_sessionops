"use client";

import { Button } from "@/components/ui";
import { googleOAuthClient, OAuthError } from "@/lib/auth/oauth";
import { showError } from "@/lib/toast/toast";
import { Google as GoogleIcon } from "@mui/icons-material";
import { useState } from "react";

/**
 * ============================================
 * GOOGLE LOGIN BUTTON
 * ============================================
 *
 * Production-grade Google OAuth 2.0 using
 * Authorization Code Flow with PKCE
 *
 * Security features:
 * - PKCE (Proof Key for Code Exchange)
 * - CSRF protection with state parameter
 * - Secure session storage
 * - Token expiry handling
 */

interface GoogleLoginButtonProps {
  /**
   * Optional redirect URL after successful login
   * Defaults to /dashboard
   */
  redirectAfterLogin?: string;

  /**
   * Button variant
   */
  variant?: "contained" | "outlined" | "text";

  /**
   * Button size
   */
  size?: "small" | "medium" | "large";

  /**
   * Full width button
   */
  fullWidth?: boolean;
}

export function GoogleLoginButton({
  redirectAfterLogin = "/home",
  variant = "outlined",
  size = "large",
  fullWidth = true,
}: GoogleLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);

      // Initiate OAuth flow - will redirect to Google
      await googleOAuthClient.initiateAuthFlow(redirectAfterLogin);

      // User will be redirected, so this code won't execute
      // unless there's an error
    } catch (error) {
      console.error("Failed to start Google login:", error);

      if (error instanceof OAuthError) {
        showError(error.message);
      } else {
        showError("Failed to start Google login. Please try again.");
      }

      setIsLoading(false);
    }
  };

  return (
    <Button
      fullWidth={fullWidth}
      variant={variant}
      size={size}
      startIcon={<GoogleIcon />}
      onClick={handleGoogleLogin}
      loading={isLoading}
      disabled={isLoading}
      sx={{
        py: 1.5,
        fontSize: "1rem",
        fontWeight: 500,
        textTransform: "none",
        borderColor: "divider",
        color: "text.primary",
        "&:hover": {
          borderColor: "primary.main",
          bgcolor: "action.hover",
        },
      }}
    >
      {isLoading ? "Redirecting to Google..." : "Continue with Google"}
    </Button>
  );
}
