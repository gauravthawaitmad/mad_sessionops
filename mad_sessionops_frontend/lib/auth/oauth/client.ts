/**
 * ============================================
 * GOOGLE OAUTH CLIENT
 * ============================================
 *
 * Production-grade OAuth 2.0 client using
 * Authorization Code Flow with PKCE
 */

import { GOOGLE_OAUTH_CONFIG, getGoogleClientId, getOAuthCallbackUrl } from "./config";
import { createPKCEChallenge, generateState, generateNonce } from "./pkce";
import { oauthStorage } from "./storage";

/**
 * OAuth error types
 */
export class OAuthError extends Error {
  constructor(
    message: string,
    public code?: string,
    public description?: string
  ) {
    super(message);
    this.name = "OAuthError";
  }
}

/**
 * OAuth client for Google authentication
 */
export class GoogleOAuthClient {
  /**
   * Initiate OAuth flow - redirects user to Google consent screen
   */
  async initiateAuthFlow(redirectAfterLogin?: string): Promise<void> {
    try {
      // Generate PKCE challenge
      const { codeVerifier, codeChallenge } = await createPKCEChallenge();

      // Generate state for CSRF protection
      const state = generateState();

      // Generate nonce for additional security
      const nonce = generateNonce();

      // Save session data
      oauthStorage.saveSession({
        state,
        codeVerifier,
        nonce,
        redirectUrl: redirectAfterLogin,
      });

      // Build authorization URL
      const authUrl = this.buildAuthorizationUrl({
        codeChallenge,
        state,
        nonce,
      });

      // Redirect to Google
      window.location.href = authUrl;
    } catch (error) {
      console.error("Failed to initiate OAuth flow:", error);
      throw new OAuthError("Failed to start Google login");
    }
  }

  /**
   * Build Google authorization URL with all parameters
   */
  private buildAuthorizationUrl(params: {
    codeChallenge: string;
    state: string;
    nonce: string;
  }): string {
    const { codeChallenge, state, nonce } = params;

    const urlParams = new URLSearchParams({
      client_id: getGoogleClientId(),
      redirect_uri: getOAuthCallbackUrl(),
      response_type: GOOGLE_OAUTH_CONFIG.responseType,
      scope: GOOGLE_OAUTH_CONFIG.scopes.join(" "),
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: GOOGLE_OAUTH_CONFIG.codeChallengeMethod,
      access_type: GOOGLE_OAUTH_CONFIG.accessType,
      prompt: GOOGLE_OAUTH_CONFIG.prompt,
      include_granted_scopes: GOOGLE_OAUTH_CONFIG.includeGrantedScopes.toString(),
    });

    return `${GOOGLE_OAUTH_CONFIG.authorizationEndpoint}?${urlParams.toString()}`;
  }

  /**
   * Handle OAuth callback (called on redirect back from Google)
   */
  async handleCallback(
    code: string,
    state: string
  ): Promise<{
    code: string;
    codeVerifier: string;
    redirectUrl?: string;
  }> {
    // Validate state (CSRF protection)
    if (!oauthStorage.validateState(state)) {
      throw new OAuthError(
        "Invalid state parameter",
        "invalid_state",
        "Possible CSRF attack detected"
      );
    }

    // Get code verifier
    const codeVerifier = oauthStorage.getCodeVerifier();
    if (!codeVerifier) {
      throw new OAuthError(
        "Code verifier not found",
        "missing_verifier",
        "OAuth session expired or invalid"
      );
    }

    // Get redirect URL
    const redirectUrl = oauthStorage.getRedirectUrl() || undefined;

    // Clear session after successful validation
    oauthStorage.clearSession();

    return {
      code,
      codeVerifier,
      redirectUrl,
    };
  }

  /**
   * Handle OAuth errors from callback
   */
  handleCallbackError(error: string, errorDescription?: string): never {
    // Clear session on error
    oauthStorage.clearSession();

    throw new OAuthError(
      errorDescription || "OAuth authentication failed",
      error,
      errorDescription
    );
  }

  /**
   * Cancel ongoing OAuth flow
   */
  cancelFlow(): void {
    oauthStorage.clearSession();
  }

  /**
   * Check if there's an ongoing OAuth flow
   */
  hasOngoingFlow(): boolean {
    return oauthStorage.hasValidSession();
  }
}

// Export singleton instance
export const googleOAuthClient = new GoogleOAuthClient();
