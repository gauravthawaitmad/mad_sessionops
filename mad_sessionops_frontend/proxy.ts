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
