import { NextResponse, type NextRequest } from "next/server";

/**
 * Gate 11 middleware skeleton.
 *
 * Today: pass-through (no redirects). The matcher is set up to evaluate
 * the routes that will eventually require auth (`/account`, `/dashboard/coordinator`),
 * so that when C8 wires in `NEXT_PUBLIC_FEATURE_AUTH` and the session check,
 * no route additions are needed — only the function body changes.
 *
 * When the flag flips ON in C8, this file will:
 *   1. Read `NEXT_PUBLIC_FEATURE_AUTH`. If false, pass through unchanged.
 *   2. For protected paths, fetch the JWT via `getToken({ req })` from
 *      `next-auth/jwt`. If absent, redirect to `/login?callbackUrl=…`.
 *   3. For public paths, pass through.
 *
 * The `callbackUrl` value is validated against an allow-list before the
 * redirect lands; see `frontend/lib/auth-allowlist.ts` (added in C5).
 */
export function middleware(_request: NextRequest): NextResponse {
  return NextResponse.next();
}

// Routes that will require auth once the flag flips. Listing them here now
// ensures the matcher doesn't change shape between C1 and C8.
export const config = {
  matcher: [
    "/account/:path*",
    "/dashboard/coordinator/:path*",
  ],
};
