import { NextRequest, NextResponse } from "next/server";

// Routes that do not require authentication.
const PUBLIC_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/set-password",
  "/auth/callback",
  "/api/health",
];

const PUBLIC_EXACT = ["/favicon.ico"];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// Decode-only expiry check — NOT signature verification. This is a UX gate to
// stop an obviously-expired token from rendering an authenticated shell; the
// backend remains the source of truth and rejects invalid/forged tokens on
// every real API call regardless of what this check decides.
function isTokenExpired(token: string): boolean {
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return true;
    const base64 = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded));
    if (typeof payload.exp !== "number") return true;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("access_token")?.value;

  if (!token || isTokenExpired(token)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("access_token");
    return response;
  }

  // Token is present and not expired — let the request through. This is
  // still just a gate: the Axios interceptor handles real 401s (bad
  // signature, revoked token, etc.) via refresh-then-logout on the first
  // failed API call.
  return NextResponse.next();
}

export const config = {
  // Run on every route except Next.js internals and static assets.
  //
  // NOTE: `public/` here previously tried to exclude files served from the
  // public/ folder — but Next.js serves them at the site root (e.g.
  // public/images/mad_logo.png -> /images/mad_logo.png), never under a
  // literal /public/ URL prefix, so that exclusion never matched anything.
  // Every request for a public/ asset (any image, on any page, including
  // unauthenticated ones like /login) was falling through to the auth gate
  // below and getting redirected to /login instead of returning the file —
  // an <img> tag has no way to render an HTML redirect, so it silently
  // showed only its alt text. Fixed by excluding by file extension instead,
  // which covers every public/ asset regardless of subfolder.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf)$).*)",
  ],
};
