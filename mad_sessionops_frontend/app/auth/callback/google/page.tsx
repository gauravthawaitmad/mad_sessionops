"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, CircularProgress, Typography, Paper, Alert } from "@mui/material";
import { CheckCircle, Error as ErrorIcon } from "@mui/icons-material";
import { googleOAuthClient, getOAuthCallbackUrl } from "@/lib/auth/oauth";
import { authService } from "@/lib/api/services/auth.service";
import { useAppDispatch } from "@/lib/redux";
import { loginSuccess } from "@/lib/redux/features/auth/authSlice";
import { setAuthCookie } from "@/lib/auth/cookieUtils";

/**
 * ============================================
 * GOOGLE OAUTH CALLBACK PAGE
 * ============================================
 *
 * Handles the redirect from Google after user authorization.
 * Exchanges authorization code for tokens via backend.
 */

type CallbackState = "processing" | "success" | "error";

export default function GoogleOAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();

  const [state, setState] = useState<CallbackState>("processing");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [errorDetails, setErrorDetails] = useState<string>("");
  const [redirecting, setRedirecting] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    // Prevent double execution in React StrictMode (development)
    if (hasRun) return;
    setHasRun(true);

    handleOAuthCallback();
  }, [hasRun]);

  /**
   * Parse and format error for user-friendly display
   */
  const handleError = (error: any) => {
    let message = "Failed to complete Google login. Please try again.";
    let details = "";

    // Check for specific error types from API client
    if (error?.code) {
      switch (error.code) {
        case "NETWORK_ERROR":
          message = "Network Error";
          details =
            "Unable to connect to the server. Please check your internet connection and try again.";
          break;

        case "SERVER_ERROR":
          message = "Server Error";
          details = "Our servers are experiencing issues. Please try again in a few moments.";
          break;

        case "VALIDATION_ERROR":
          message = "Invalid Request";
          details =
            error.message || "The authentication data is invalid. Please try logging in again.";
          break;

        case "NOT_FOUND":
          message = "Endpoint Not Found";
          details =
            "The authentication endpoint is not available. The backend may not be running or configured correctly.";
          break;

        case "FORBIDDEN":
          message = "Access Denied";
          details = error.message || "You do not have permission to access this resource.";
          break;

        default:
          message = error.message || message;
          details = error.description || "";
      }
    } else if (error instanceof Error) {
      message = error.message;
    }

    setState("error");
    setErrorMessage(message);
    setErrorDetails(details);

    // Redirect to login page after error
    setTimeout(() => {
      router.push("/login");
    }, 5000);
  };

  const handleOAuthCallback = async () => {
    try {
      // Get parameters from URL
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      // Handle OAuth errors from Google
      if (error) {
        handleError({
          code: error,
          message: "Google Authentication Failed",
          description: errorDescription || "The authentication request was denied or failed.",
        });
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        handleError({
          code: "INVALID_CALLBACK",
          message: "Invalid Callback Parameters",
          description:
            "Missing authorization code or state parameter. Please try logging in again.",
        });
        return;
      }

      // Validate state and get code verifier (CSRF protection)
      const { codeVerifier, redirectUrl } = await googleOAuthClient.handleCallback(code, state);

      // Exchange authorization code for tokens via backend
      const authResponse = await authService.loginWithGoogleOAuth({
        code,
        codeVerifier,
        redirectUri: getOAuthCallbackUrl(),
      });

      // Update Redux store with authentication data.
      // loginSuccess is a pure reducer, so we set the cookie here.
      dispatch(
        loginSuccess({
          user: authResponse.user,
          accessToken: authResponse.accessToken,
          refreshToken: authResponse.refreshToken,
        })
      );
      setAuthCookie(authResponse.accessToken);

      // Show success state briefly
      setState("success");

      // Redirect to dashboard or specified URL after short delay
      setTimeout(() => {
        setRedirecting(true);
        router.push(redirectUrl || "/dashboard");
      }, 1500);
    } catch (error) {
      console.error("OAuth callback error:", error);
      handleError(error);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 3,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          maxWidth: 500,
          width: "100%",
          p: 4,
          textAlign: "center",
        }}
      >
        {/* Processing State */}
        {state === "processing" && (
          <Box>
            <CircularProgress size={60} sx={{ mb: 3 }} />
            <Typography variant="h6" gutterBottom>
              Completing Google Login
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please wait while we verify your credentials...
            </Typography>
          </Box>
        )}

        {/* Success State */}
        {state === "success" && (
          <Box>
            <CheckCircle
              sx={{
                fontSize: 60,
                color: "success.main",
                mb: 2,
              }}
            />
            <Typography variant="h6" gutterBottom color="success.main">
              Login Successful!
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {redirecting ? "Redirecting you now..." : "Redirecting to your dashboard..."}
            </Typography>
            {redirecting && <CircularProgress size={24} />}
          </Box>
        )}

        {/* Error State */}
        {state === "error" && (
          <Box>
            <ErrorIcon
              sx={{
                fontSize: 60,
                color: "error.main",
                mb: 2,
              }}
            />
            <Typography variant="h6" gutterBottom color="error.main">
              {errorMessage}
            </Typography>
            <Alert severity="error" sx={{ mt: 2, mb: 2, textAlign: "left" }}>
              {errorDetails || errorMessage}
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Redirecting to login page in 5 seconds...
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
