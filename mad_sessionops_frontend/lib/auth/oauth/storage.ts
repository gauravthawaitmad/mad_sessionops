/**
 * ============================================
 * OAUTH STORAGE UTILITIES
 * ============================================
 *
 * Secure storage for OAuth state, PKCE parameters, and session data
 * Uses sessionStorage for security (cleared when tab closes)
 */

import { OAUTH_STORAGE_KEYS } from './config';

/**
 * OAuth session data structure
 */
export interface OAuthSessionData {
  state: string;
  codeVerifier: string;
  nonce: string;
  redirectUrl?: string;
  timestamp: number;
}

/**
 * Storage interface for OAuth data
 */
class OAuthStorage {
  private readonly SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes

  /**
   * Check if we're in a browser environment
   */
  private isClient(): boolean {
    return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
  }

  /**
   * Save OAuth session data
   */
  saveSession(data: Omit<OAuthSessionData, 'timestamp'>): void {
    if (!this.isClient()) return;

    const sessionData: OAuthSessionData = {
      ...data,
      timestamp: Date.now(),
    };

    try {
      sessionStorage.setItem(OAUTH_STORAGE_KEYS.STATE, data.state);
      sessionStorage.setItem(OAUTH_STORAGE_KEYS.CODE_VERIFIER, data.codeVerifier);
      sessionStorage.setItem(OAUTH_STORAGE_KEYS.NONCE, data.nonce);

      if (data.redirectUrl) {
        sessionStorage.setItem(OAUTH_STORAGE_KEYS.REDIRECT_URL, data.redirectUrl);
      }

      // Store timestamp for expiry check
      sessionStorage.setItem('oauth_timestamp', sessionData.timestamp.toString());
    } catch (error) {
      console.error('Failed to save OAuth session:', error);
      throw new Error('Failed to save OAuth session data');
    }
  }

  /**
   * Retrieve OAuth session data
   */
  getSession(): OAuthSessionData | null {
    if (!this.isClient()) return null;

    try {
      const state = sessionStorage.getItem(OAUTH_STORAGE_KEYS.STATE);
      const codeVerifier = sessionStorage.getItem(OAUTH_STORAGE_KEYS.CODE_VERIFIER);
      const nonce = sessionStorage.getItem(OAUTH_STORAGE_KEYS.NONCE);
      const redirectUrl = sessionStorage.getItem(OAUTH_STORAGE_KEYS.REDIRECT_URL);
      const timestamp = sessionStorage.getItem('oauth_timestamp');

      if (!state || !codeVerifier || !nonce || !timestamp) {
        return null;
      }

      const sessionData: OAuthSessionData = {
        state,
        codeVerifier,
        nonce,
        redirectUrl: redirectUrl || undefined,
        timestamp: parseInt(timestamp, 10),
      };

      // Check if session has expired
      if (Date.now() - sessionData.timestamp > this.SESSION_TIMEOUT) {
        this.clearSession();
        return null;
      }

      return sessionData;
    } catch (error) {
      console.error('Failed to retrieve OAuth session:', error);
      return null;
    }
  }

  /**
   * Validate state parameter (CSRF protection)
   */
  validateState(receivedState: string): boolean {
    if (!this.isClient()) return false;

    const session = this.getSession();

    if (!session) {
      console.error('No OAuth session found');
      return false;
    }

    const isValid = session.state === receivedState;

    if (!isValid) {
      console.error('State mismatch - possible CSRF attack');
    }

    return isValid;
  }

  /**
   * Get code verifier for token exchange
   */
  getCodeVerifier(): string | null {
    if (!this.isClient()) return null;

    const session = this.getSession();
    return session?.codeVerifier || null;
  }

  /**
   * Get redirect URL (where to go after OAuth)
   */
  getRedirectUrl(): string | null {
    if (!this.isClient()) return null;

    const session = this.getSession();
    return session?.redirectUrl || null;
  }

  /**
   * Clear OAuth session data
   */
  clearSession(): void {
    if (!this.isClient()) return;

    try {
      sessionStorage.removeItem(OAUTH_STORAGE_KEYS.STATE);
      sessionStorage.removeItem(OAUTH_STORAGE_KEYS.CODE_VERIFIER);
      sessionStorage.removeItem(OAUTH_STORAGE_KEYS.NONCE);
      sessionStorage.removeItem(OAUTH_STORAGE_KEYS.REDIRECT_URL);
      sessionStorage.removeItem('oauth_timestamp');
    } catch (error) {
      console.error('Failed to clear OAuth session:', error);
    }
  }

  /**
   * Check if session exists and is valid
   */
  hasValidSession(): boolean {
    return this.getSession() !== null;
  }
}

// Export singleton instance
export const oauthStorage = new OAuthStorage();
