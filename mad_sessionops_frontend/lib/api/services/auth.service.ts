import { api } from "../client";
import type {
  LoginCredentials,
  RegisterData,
  AuthResponse,
  ScopeWarning,
  VerifyTokenResponse,
  RefreshTokenResponse,
  PasswordResetRequest,
  PasswordResetConfirm,
  ChangePasswordData,
  User,
} from "@/lib/redux/features/auth/types";

/**
 * ============================================
 * AUTH SERVICE
 * ============================================
 *
 * Authentication-specific API operations.
 */

const BASE_URL = "/auth";

/**
 * ============================================
 * BACKEND RESPONSE TYPES
 * ============================================
 *
 * These match the actual backend response structure
 */

interface BackendUser {
  user_id: number;
  email: string;
  user_display_name: string;
  user_login: string;
  user_role: string;
  contact?: string;
  city?: string | null;
  state?: string | null;
  center?: string | null;
  auth_methods?: string[];
  user_created_datetime?: string;
}

interface BackendTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface BackendScopeWarning {
  code: string;
  message: string;
}

interface BackendAuthResponse {
  user: BackendUser;
  tokens: BackendTokens;
  scope_warning?: BackendScopeWarning | null;
}

/**
 * ============================================
 * RESPONSE MAPPERS
 * ============================================
 *
 * Transform backend responses to frontend format
 */

/**
 * Map backend user to frontend User type
 */
function mapBackendUser(backendUser: BackendUser): User {
  return {
    id: String(backendUser.user_id),
    email: backendUser.email,
    name: backendUser.user_display_name,
    role: backendUser.user_role,
    phone: backendUser.contact,
    emailVerified: true, // Assuming verified if logged in
    createdAt: backendUser.user_created_datetime || new Date().toISOString(),
    updatedAt: backendUser.user_created_datetime || new Date().toISOString(),
    // Optional fields
    metadata: {
      user_login: backendUser.user_login,
      city: backendUser.city,
      state: backendUser.state,
      center: backendUser.center,
      auth_methods: backendUser.auth_methods,
    },
  };
}

/**
 * Map backend auth response to frontend AuthResponse type
 */
function mapAuthResponse(backendResponse: BackendAuthResponse): AuthResponse {
  const scopeWarning: ScopeWarning | null = backendResponse.scope_warning
    ? { code: backendResponse.scope_warning.code, message: backendResponse.scope_warning.message }
    : null;
  return {
    user: mapBackendUser(backendResponse.user),
    accessToken: backendResponse.tokens.access_token,
    refreshToken: backendResponse.tokens.refresh_token,
    expiresIn: backendResponse.tokens.expires_in,
    scopeWarning,
  };
}

export const authService = {
  /**
   * Login
   */
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<BackendAuthResponse>(`${BASE_URL}/login`, credentials);
    return mapAuthResponse(response);
  },

  /**
   * Login with Google (Legacy - One Tap)
   * @deprecated Use loginWithGoogleOAuth instead
   */
  loginWithGoogle: async (googleToken: string): Promise<AuthResponse> => {
    const response = await api.post<BackendAuthResponse>(`${BASE_URL}/google/login`, {
      googleToken,
    });
    return mapAuthResponse(response);
  },

  /**
   * Login with Google OAuth (Authorization Code Flow)
   * Exchanges authorization code for tokens on backend
   */
  loginWithGoogleOAuth: async (data: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<AuthResponse> => {
    const response = await api.post<BackendAuthResponse>(`${BASE_URL}/google/oauth/callback`, data);
    return mapAuthResponse(response);
  },

  /**
   * Register
   */
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post<BackendAuthResponse>(`${BASE_URL}/register`, data);
    return mapAuthResponse(response);
  },

  /**
   * Logout — backend requires the refresh_token to blacklist it
   */
  logout: (refreshToken: string): Promise<void> => {
    return api.post(`${BASE_URL}/logout`, { refresh_token: refreshToken });
  },

  /**
   * Verify Token
   */
  verifyToken: (): Promise<VerifyTokenResponse> => {
    return api.post(`${BASE_URL}/verify-token`);
  },

  /**
   * Refresh Token — backend endpoint is /refresh, body key is refresh_token
   */
  refreshToken: (refreshToken: string): Promise<RefreshTokenResponse> => {
    return api.post(`${BASE_URL}/refresh`, { refresh_token: refreshToken });
  },

  /**
   * Forgot Password
   */
  forgotPassword: (data: PasswordResetRequest): Promise<void> => {
    return api.post(`${BASE_URL}/password/forgot`, { email: data.email });
  },

  /**
   * Validate a password-reset token (no side effects — safe to call on page load).
   * Returns { valid, reason } where reason is one of:
   *   'valid' | 'consumed' | 'superseded' | 'time_expired' | 'not_found'
   */
  validateResetToken: async (token: string): Promise<{ valid: boolean; reason: string }> => {
    const response = await api.get<{ message: string; success: boolean }>(
      `${BASE_URL}/password/reset/validate`,
      { params: { token } }
    );
    return { valid: response.success, reason: response.message };
  },

  /**
   * Reset Password
   */
  resetPassword: (data: PasswordResetConfirm): Promise<void> => {
    return api.post(`${BASE_URL}/password/reset`, {
      token: data.token,
      new_password: data.newPassword,
    });
  },

  /**
   * Set Password (first-time, Hasura-synced users)
   */
  setPassword: (newPassword: string): Promise<void> => {
    return api.post(`${BASE_URL}/password/set`, { new_password: newPassword });
  },

  /**
   * Change Password (logged-in user)
   */
  changePassword: (data: ChangePasswordData): Promise<void> => {
    return api.post(`${BASE_URL}/password/change`, {
      old_password: data.currentPassword,
      new_password: data.newPassword,
    });
  },
};

export default authService;
