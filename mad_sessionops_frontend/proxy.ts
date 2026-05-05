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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("access_token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Token is present — let the request through.
  // Do NOT attempt to verify or refresh here; the Axios interceptor handles
  // refresh on the first 401 from the API. Middleware only acts as a gate.
  return NextResponse.next();
}

export const config = {
  // Run on every route except Next.js internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
