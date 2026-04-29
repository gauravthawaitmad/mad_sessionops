/**
 * Authentication Types
 * Simplified - No JWT logic on frontend
 */

// ============================================
// USER TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;

  // Dynamic role from backend
  role: string;

  // Optional: Multiple roles
  roles?: string[];

  // Optional: Granular permissions
  permissions?: string[];

  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;

  // Optional: Additional fields
  phone?: string;
  department?: string;
  organization?: string;
  metadata?: Record<string, any>;
}

/**
 * Common Role Constants (Optional)
 */
export const COMMON_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  MANAGER: "manager",
  USER: "user",
  GUEST: "guest",
} as const;

// ============================================
// ROLE/PERMISSION HELPERS
// ============================================

export function hasRole(user: User | null, role: string): boolean {
  if (!user) return false;
  if (user.role === role) return true;
  if (user.roles && user.roles.includes(role)) return true;
  return false;
}

export function hasAnyRole(user: User | null, roles: string[]): boolean {
  if (!user) return false;
  return roles.some((role) => hasRole(user, role));
}

export function hasAllRoles(user: User | null, roles: string[]): boolean {
  if (!user) return false;
  return roles.every((role) => hasRole(user, role));
}

export function hasPermission(user: User | null, permission: string): boolean {
  if (!user || !user.permissions) return false;
  return user.permissions.includes(permission);
}

export function hasAnyPermission(user: User | null, permissions: string[]): boolean {
  if (!user || !user.permissions) return false;
  return permissions.some((permission) => user.permissions!.includes(permission));
}

// ============================================
// AUTH STATE
// ============================================

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  // Tokens are opaque strings - no decoding on frontend
  accessToken: string | null;
  refreshToken: string | null;

  error: string | null;
  lastActivity: number | null;
  sessionTimeout: number;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  phone?: string;
  acceptTerms: boolean;
}

/**
 * Auth Response from Backend
 */
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  // Backend tells us when to refresh, no need to decode
  expiresIn: number; // seconds until token expires
}

/**
 * Token Verification Response
 *
 * Backend API: POST /api/auth/verify-token
 * Checks if current token is valid
 */
export interface VerifyTokenResponse {
  valid: boolean;
  user?: User; // If valid, return user data
  expiresIn?: number; // Seconds until expiry (if valid)
}

/**
 * Refresh Token Response
 *
 * Backend API: POST /api/auth/refresh-token
 */
export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateProfileData {
  name?: string;
  phone?: string;
  avatar?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// ============================================
// ERROR TYPES
// ============================================

export enum AuthErrorCode {
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  EMAIL_ALREADY_EXISTS = "EMAIL_ALREADY_EXISTS",
  WEAK_PASSWORD = "WEAK_PASSWORD",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  TOKEN_INVALID = "TOKEN_INVALID",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  NETWORK_ERROR = "NETWORK_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export interface AuthError {
  code: AuthErrorCode;
  message: string;
  details?: any;
}

// ============================================
// ROUTE PROTECTION
// ============================================

export interface RouteProtection {
  requiresAuth: boolean;
  requiredRoles?: string[];
  requiredPermissions?: string[];
  requireAllRoles?: boolean;
  requireAllPermissions?: boolean;
}
