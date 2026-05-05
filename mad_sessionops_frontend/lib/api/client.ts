import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from "axios";
import { getAccessToken, getRefreshToken, storeDispatch } from "@/lib/redux/storeAccessor";
import { setAuthCookie, clearAuthCookie } from "@/lib/auth/cookieUtils";

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const REQUEST_TIMEOUT = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || "30000", 10);

// Prevent multiple simultaneous refresh calls — queue waiting requests.
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

// ============================================================================
// AXIOS INSTANCE
// ============================================================================

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  responseType: "json",
  withCredentials: true,
});

// ============================================================================
// REQUEST INTERCEPTOR
// ============================================================================

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Read token from Redux store (single source of truth).
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.headers) {
      config.headers["X-Request-ID"] = generateRequestId();
      config.headers["X-Client-Version"] = "1.0.0";
      config.headers["X-Client-Platform"] = "web";
      config.headers["X-Timezone"] =
        Intl.DateTimeFormat().resolvedOptions().timeZone;
      config.headers["Accept-Language"] = navigator.language;
    }

    (config as any).metadata = { startTime: Date.now() };

    if (process.env.NODE_ENV === "development") {
      console.group(
        `🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`
      );
      console.log("URL:", `${config.baseURL}${config.url}`);
      console.log("Data:", config.data);
      console.groupEnd();
    }

    return config;
  },
  (error: AxiosError) => {
    console.error("❌ Request setup failed:", error);
    return Promise.reject({
      message: "Failed to setup request",
      code: "REQUEST_SETUP_ERROR",
      originalError: error,
    });
  }
);

// ============================================================================
// RESPONSE INTERCEPTOR
// ============================================================================

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const config = response.config as any;
    if (config.metadata?.startTime) {
      const duration = Date.now() - config.metadata.startTime;
      if (duration > 3000)
        console.warn(`⚠️ Slow API request (${duration}ms):`, config.url);
      if (process.env.NODE_ENV === "development") {
        console.group(
          `✅ API Response: ${config.method?.toUpperCase()} ${config.url}`
        );
        console.log("Status:", response.status, "Duration:", `${duration}ms`);
        console.groupEnd();
      }
    }
    return response;
  },

  async (error: AxiosError) => {
    const config = error.config as any;
    const response = error.response;

    if (process.env.NODE_ENV === "development" && config?.metadata?.startTime) {
      const duration = Date.now() - config.metadata.startTime;
      console.group(
        `❌ API Error: ${config.method?.toUpperCase()} ${config.url}`
      );
      console.log("Status:", response?.status, "Duration:", `${duration}ms`);
      console.groupEnd();
    }

    // 1. Network error
    if (!response) {
      return Promise.reject({
        message: "Network error. Please check your internet connection.",
        code: "NETWORK_ERROR",
        status: 0,
      });
    }

    // 2. 401 — either a business-level auth failure or an expired session
    if (response.status === 401) {
      const url = config?.url || "";
      const isRefreshEndpoint = url.includes("/auth/refresh");

      // These public endpoints legitimately return 401 as a business error
      // (wrong password, invalid token, etc.). Do NOT attempt a token refresh —
      // just surface the error message so the form can display it.
      const isPublicAuthEndpoint =
        url.includes("/auth/login") ||
        url.includes("/auth/register") ||
        url.includes("/auth/google") ||
        url.includes("/auth/password/reset") ||
        url.includes("/auth/password/forgot") ||
        url.includes("/auth/password/validate");

      if (isRefreshEndpoint) {
        // Refresh token itself is expired — log out.
        clearAuthCookie();
        storeDispatch({ type: "auth/resetAuth" });
        if (typeof window !== "undefined") window.location.href = "/login";
        return Promise.reject({
          message: "Session expired. Please sign in again.",
          code: "SESSION_EXPIRED",
          status: 401,
        });
      }

      if (isPublicAuthEndpoint) {
        // Pass the backend message straight through — no redirect, no refresh.
        const errorData = response.data as any;
        return Promise.reject({
          message: extractMessage(errorData) || "Authentication failed.",
          code: "AUTH_ERROR",
          status: 401,
          data: errorData,
        });
      }

      // Protected endpoint returned 401 — access token expired, try refresh.
      if (!isRefreshing) {
        isRefreshing = true;

        try {
          const refreshToken = getRefreshToken();
          if (!refreshToken) throw new Error("No refresh token available");

          const refreshResponse = await axios.post(
            `${API_BASE_URL}/auth/refresh`,
            { refresh_token: refreshToken }
          );

          const { accessToken, refreshToken: newRefreshToken } =
            refreshResponse.data;

          storeDispatch({
            type: "auth/updateTokens",
            payload: { accessToken, refreshToken: newRefreshToken },
          });
          setAuthCookie(accessToken);

          onTokenRefreshed(accessToken);

          if (config.headers) {
            config.headers.Authorization = `Bearer ${accessToken}`;
          }

          isRefreshing = false;
          return apiClient.request(config);
        } catch {
          isRefreshing = false;
          clearAuthCookie();
          storeDispatch({ type: "auth/resetAuth" });
          if (typeof window !== "undefined") window.location.href = "/login";
          return Promise.reject({
            message: "Session expired. Please sign in again.",
            code: "SESSION_EXPIRED",
            status: 401,
          });
        }
      }

      return new Promise((resolve) => {
        subscribeTokenRefresh((token: string) => {
          if (config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }
          resolve(apiClient.request(config));
        });
      });
    }

    // 3–8. Other HTTP errors
    if (response.status === 403) {
      return Promise.reject({
        message: "You do not have permission to perform this action.",
        code: "FORBIDDEN",
        status: 403,
        data: response.data,
      });
    }

    if (response.status === 404) {
      const errorData = response.data as any;
      return Promise.reject({
        message: extractMessage(errorData) || "The requested resource was not found.",
        code: "NOT_FOUND",
        status: 404,
        data: errorData,
      });
    }

    if (response.status === 422) {
      const errorData = response.data as any;
      return Promise.reject({
        message: extractMessage(errorData) || "Validation error",
        code: "VALIDATION_ERROR",
        status: 422,
        errors: errorData?.errors,
        data: errorData,
      });
    }

    if (response.status === 429) {
      const retryAfter = response.headers["retry-after"];
      return Promise.reject({
        message: `Too many requests. Please try again ${retryAfter ? `after ${retryAfter} seconds` : "later"}.`,
        code: "RATE_LIMIT_EXCEEDED",
        status: 429,
        retryAfter,
      });
    }

    if (response.status >= 500) {
      return Promise.reject({
        message: "Server error. Please try again later.",
        code: "SERVER_ERROR",
        status: response.status,
        data: response.data,
      });
    }

    const errorData = response.data as any;
    return Promise.reject({
      message: extractMessage(errorData) || "An unexpected error occurred",
      code: errorData?.code || "UNKNOWN_ERROR",
      status: response.status,
      errors: errorData?.errors,
      data: errorData,
    });
  }
);

// ============================================================================
// HELPERS
// ============================================================================

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract a human-readable message from a backend error body.
 * Django Ninja's HttpError returns { detail: "..." }.
 * Custom error envelopes may use { message: "..." } or { error: { message: "..." } }.
 */
function extractMessage(data: any): string | undefined {
  if (!data) return undefined;
  return data.detail ?? data.message ?? data.error?.message ?? undefined;
}

// ============================================================================
// API CLIENT METHODS
// ============================================================================

export async function get<T = any>(url: string, config?: any): Promise<T> {
  return (await apiClient.get<T>(url, config)).data;
}

export async function post<T = any>(
  url: string,
  data?: any,
  config?: any
): Promise<T> {
  return (await apiClient.post<T>(url, data, config)).data;
}

export async function put<T = any>(
  url: string,
  data?: any,
  config?: any
): Promise<T> {
  return (await apiClient.put<T>(url, data, config)).data;
}

export async function patch<T = any>(
  url: string,
  data?: any,
  config?: any
): Promise<T> {
  return (await apiClient.patch<T>(url, data, config)).data;
}

export async function del<T = any>(url: string, config?: any): Promise<T> {
  return (await apiClient.delete<T>(url, config)).data;
}

export async function upload<T = any>(
  url: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);

  return (
    await apiClient.post<T>(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (e.total && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    })
  ).data;
}

export async function download(url: string, filename: string): Promise<void> {
  const response = await apiClient.get(url, { responseType: "blob" });
  const blob = new Blob([response.data]);
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(link.href);
}

export const api = { get, post, put, patch, delete: del, upload, download };

export default apiClient;
