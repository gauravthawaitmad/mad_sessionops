/**
 * ============================================
 * PKCE UTILITIES
 * ============================================
 *
 * Proof Key for Code Exchange (PKCE) implementation
 * for secure OAuth 2.0 Authorization Code Flow
 *
 * RFC 7636: https://tools.ietf.org/html/rfc7636
 */

/**
 * Generate a cryptographically secure random string
 */
function generateRandomString(length: number): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const randomValues = new Uint8Array(length);

  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(randomValues);
  } else {
    // Fallback for non-browser environments (shouldn't happen in Next.js client)
    throw new Error("Crypto API not available");
  }

  return Array.from(randomValues)
    .map((value) => charset[value % charset.length])
    .join("");
}

/**
 * Generate a code verifier (random string)
 * Length: 43-128 characters (we use 128 for max security)
 */
export function generateCodeVerifier(): string {
  return generateRandomString(128);
}

/**
 * Generate a code challenge from code verifier using SHA-256
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  // Encode the code verifier as UTF-8
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);

  // Hash using SHA-256
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);

  // Convert to base64url encoding
  return base64UrlEncode(hashBuffer);
}

/**
 * Base64 URL encoding (without padding)
 */
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Generate a random state parameter for CSRF protection
 */
export function generateState(): string {
  return generateRandomString(32);
}

/**
 * Generate a random nonce for additional security
 */
export function generateNonce(): string {
  return generateRandomString(32);
}

/**
 * Create PKCE challenge pair
 */
export async function createPKCEChallenge(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  return {
    codeVerifier,
    codeChallenge,
  };
}
