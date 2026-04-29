/**
 * ============================================
 * GOOGLE OAUTH CONFIGURATION
 * ============================================
 *
 * Production-grade OAuth 2.0 configuration
 * using Authorization Code Flow with PKCE
 */

export const GOOGLE_OAUTH_CONFIG = {
  // Google OAuth endpoints
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',

  // Required scopes for user authentication
  scopes: [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],

  // OAuth parameters
  responseType: 'code',
  grantType: 'authorization_code',

  // PKCE configuration
  codeChallengeMethod: 'S256', // SHA-256

  // Security settings
  prompt: 'select_account', // Force account selection for better UX
  accessType: 'offline', // Get refresh token (if needed)
  includeGrantedScopes: true,
} as const;

export const OAUTH_STORAGE_KEYS = {
  STATE: 'oauth_state',
  CODE_VERIFIER: 'oauth_code_verifier',
  NONCE: 'oauth_nonce',
  REDIRECT_URL: 'oauth_redirect_url',
} as const;

/**
 * Get OAuth callback URL based on environment
 */
export function getOAuthCallbackUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/auth/callback/google`;
}

/**
 * Get Google OAuth client ID
 */
export function getGoogleClientId(): string {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured');
  }

  return clientId;
}
