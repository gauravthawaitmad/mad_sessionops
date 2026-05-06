import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import type { RootState } from "../../store";
import services from "@/lib/api/services/index";
import type {
  AuthState,
  User,
  LoginCredentials,
  RegisterData,
  AuthResponse,
  VerifyTokenResponse,
  RefreshTokenResponse,
} from "./types";
import { cleanLocalStorage } from "./tokenUtils";
import { setAuthCookie, clearAuthCookie } from "@/lib/auth/cookieUtils";

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  accessToken: null,
  refreshToken: null,
  error: null,
  lastActivity: null,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
};

// ============================================================================
// ASYNC THUNKS
// ============================================================================

/**
 * Initialize Auth — on app startup, rehydrate from persisted Redux state.
 * redux-persist has already restored the state by the time PersistGate lets
 * the app render, so we just sync the cookie and return the stored session.
 */
export const initializeAuth = createAsyncThunk(
  "auth/initialize",
  async (_, { getState, rejectWithValue }) => {
    try {
      cleanLocalStorage();

      const state = getState() as RootState;
      const { accessToken, refreshToken, user } = state.auth;

      // No session at all.
      if (!refreshToken) {
        return null;
      }

      // Full session — sync the cookie and return.
      if (accessToken && user) {
        setAuthCookie(accessToken);
        return { user, accessToken, refreshToken };
      }

      // Partial state: refresh token exists but access token is missing.
      // Use the refresh token to recover the session silently.
      const tokenResponse = await services.auth.refreshToken(refreshToken);
      setAuthCookie(tokenResponse.accessToken);

      // If user data is persisted, trust it. Otherwise the user must log in again.
      if (!user) {
        return null;
      }

      return {
        user,
        accessToken: tokenResponse.accessToken,
        refreshToken,
      };
    } catch {
      // Refresh failed — treat as logged out so the user gets a clean login.
      clearAuthCookie();
      return null;
    }
  }
);

export const loginUser = createAsyncThunk(
  "auth/login",
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await services.auth.login(credentials);
      setAuthCookie(response.accessToken);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || "Login failed");
    }
  }
);

/** @deprecated Use loginWithGoogleOAuth instead */
export const loginWithGoogleToken = createAsyncThunk(
  "auth/loginWithGoogle",
  async (googleToken: string, { rejectWithValue }) => {
    try {
      const response = await services.auth.loginWithGoogle(googleToken);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || "Google login failed");
    }
  }
);

export const loginWithGoogleOAuth = createAsyncThunk(
  "auth/loginWithGoogleOAuth",
  async (
    data: { code: string; codeVerifier: string; redirectUri: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await services.auth.loginWithGoogleOAuth(data);
      setAuthCookie(response.accessToken);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || "Google OAuth login failed");
    }
  }
);

export const registerUser = createAsyncThunk(
  "auth/register",
  async (data: RegisterData, { rejectWithValue }) => {
    try {
      const response = await services.auth.register(data);
      setAuthCookie(response.accessToken);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || "Registration failed");
    }
  }
);

export const verifyToken = createAsyncThunk(
  "auth/verify",
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as RootState;
      if (!state.auth.accessToken) throw new Error("No token available");
      const response = await services.auth.verifyToken();
      return { valid: response.valid };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const refreshAccessToken = createAsyncThunk(
  "auth/refresh",
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as RootState;
      const refreshToken = state.auth.refreshToken;
      if (!refreshToken) throw new Error("No refresh token available");
      const response = await services.auth.refreshToken(refreshToken);
      setAuthCookie(response.accessToken);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const logoutUser = createAsyncThunk(
  "auth/logout",
  async (_, { getState }) => {
    const state = getState() as RootState;
    const { accessToken, refreshToken } = state.auth;
    try {
      // Only hit the backend if we have a valid session to blacklist.
      // Without an access token the request would 401 and trigger the
      // refresh interceptor, creating an unintended cycle.
      if (accessToken && refreshToken) {
        await services.auth.logout(refreshToken);
      }
    } catch (error) {
      console.error("Logout API error (continuing local cleanup):", error);
    } finally {
      clearAuthCookie();
    }
    return null;
  }
);

// ============================================================================
// SLICE
// ============================================================================

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    /** Set auth state synchronously after an OAuth callback. */
    loginSuccess: (
      state,
      action: PayloadAction<{ user: User; accessToken: string; refreshToken: string }>
    ) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.isAuthenticated = true;
      state.isLoading = false;
      state.error = null;
      state.lastActivity = Date.now();
      // Cookie is set by the OAuth callback page after dispatching this action
      // to keep the reducer pure. See app/auth/callback/google/page.tsx.
    },

    /**
     * Update tokens in Redux state — called by the Axios refresh interceptor
     * via a raw action type string to avoid a circular import.
     * The interceptor also calls setAuthCookie() directly.
     */
    updateTokens: (
      state,
      action: PayloadAction<{ accessToken: string; refreshToken?: string }>
    ) => {
      state.accessToken = action.payload.accessToken;
      if (action.payload.refreshToken) {
        state.refreshToken = action.payload.refreshToken;
      }
      state.lastActivity = Date.now();
    },

    /**
     * Reset all auth state — called by the Axios client on unrecoverable 401.
     * Action type: 'auth/resetAuth' (used as a string in client.ts to avoid
     * a circular import).
     */
    resetAuth: () => {
      clearAuthCookie();
      return { ...initialState, isInitialized: true };
    },

    updateActivity: (state) => {
      state.lastActivity = Date.now();
    },

    checkSessionTimeout: (state) => {
      if (state.isAuthenticated && state.lastActivity) {
        const timeSinceActivity = Date.now() - state.lastActivity;
        if (timeSinceActivity > state.sessionTimeout) {
          clearAuthCookie();
          state.user = null;
          state.isAuthenticated = false;
          state.accessToken = null;
          state.refreshToken = null;
          state.error = "Session expired due to inactivity";
        }
      }
    },

    clearError: (state) => {
      state.error = null;
    },

    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
  },

  extraReducers: (builder) => {
    // Initialize Auth
    builder
      .addCase(initializeAuth.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isInitialized = true;
        if (action.payload) {
          state.user = action.payload.user;
          state.isAuthenticated = true;
          state.accessToken = action.payload.accessToken;
          state.refreshToken = action.payload.refreshToken;
          state.lastActivity = Date.now();
          state.error = null;
        }
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.isLoading = false;
        state.isInitialized = true;
        state.error = action.payload as string;
      });

    // Login
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.lastActivity = Date.now();
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.error = action.payload as string;
      });

    // Register
    builder
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.lastActivity = Date.now();
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Verify Token
    builder.addCase(verifyToken.rejected, (state) => {
      clearAuthCookie();
      state.user = null;
      state.isAuthenticated = false;
      state.accessToken = null;
      state.refreshToken = null;
    });

    // Refresh Token
    builder
      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        // Cookie already updated in the thunk.
      })
      .addCase(refreshAccessToken.rejected, (state) => {
        clearAuthCookie();
        state.user = null;
        state.isAuthenticated = false;
        state.accessToken = null;
        state.refreshToken = null;
      });

    // Logout
    builder.addCase(logoutUser.fulfilled, () => {
      // Cookie already cleared in the thunk.
      return { ...initialState, isInitialized: true };
    });

    // Google OAuth
    builder
      .addCase(loginWithGoogleOAuth.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginWithGoogleOAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.lastActivity = Date.now();
        state.error = null;
      })
      .addCase(loginWithGoogleOAuth.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.error = action.payload as string;
      });
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export const {
  loginSuccess,
  updateTokens,
  resetAuth,
  updateActivity,
  checkSessionTimeout,
  clearError,
  setUser,
} = authSlice.actions;

export const selectAuth = (state: RootState) => state.auth;
export const selectUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectIsLoading = (state: RootState) => state.auth.isLoading;
export const selectError = (state: RootState) => state.auth.error;
export const selectIsInitialized = (state: RootState) => state.auth.isInitialized;
export const selectUserRole = (state: RootState) => state.auth.user?.role;
export const selectAccessToken = (state: RootState) => state.auth.accessToken;

export default authSlice.reducer;
