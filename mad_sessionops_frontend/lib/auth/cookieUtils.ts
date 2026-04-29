const ACCESS_TOKEN_COOKIE = "access_token";

/**
 * Set the access_token cookie so Next.js middleware can read it for route
 * protection. httpOnly is intentionally false — the Axios refresh interceptor
 * must be able to update it from client-side JS.
 */
export function setAuthCookie(token: string): void {
  if (typeof document === "undefined") return;
  // 24-hour max-age; the refresh interceptor extends it on each refresh.
  document.cookie = `${ACCESS_TOKEN_COOKIE}=${token}; path=/; max-age=${60 * 60 * 24}; SameSite=Strict`;
}

export function clearAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ACCESS_TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Strict`;
}
