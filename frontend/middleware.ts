import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth + tier guards for protected routes.
 *
 * Routes:
 *   - `/account/*` — needs a session. Gated only when the auth UX flag is
 *     on; if off, `/account` is not part of the user's mental model and
 *     the route is unreachable in nav anyway, so we pass through.
 *   - `/dashboard/coordinator/*` — needs a session AND `tier >= 3`,
 *     UNCONDITIONALLY. The page surfaces population-level detail at
 *     identifiable institutions (Tier 3+ data per the access model). This
 *     gate runs regardless of `NEXT_PUBLIC_FEATURE_AUTH` because the
 *     dashboard's tier scope is independent of whether the auth UI is
 *     visible. There is no service-token bypass at the middleware layer —
 *     the service token is a server-to-server fallback used inside SSR
 *     fetchers, never a browser-route bypass.
 *
 * The matcher in `config` keeps middleware off the public surface.
 */

const COORDINATOR_MIN_TIER = 3;

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;
  const flagOn = process.env.NEXT_PUBLIC_FEATURE_AUTH === "true";

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (path.startsWith("/account")) {
    if (!flagOn) {
      return NextResponse.next();
    }
    if (!token) {
      return redirectToLogin(request, path);
    }
    return NextResponse.next();
  }

  if (path.startsWith("/dashboard/coordinator")) {
    const tier = typeof token?.tier === "number" ? token.tier : 0;
    if (tier < COORDINATOR_MIN_TIER) {
      // When the auth UX flag is on, send unauthenticated/under-tier
      // visitors to login with a callback. When the flag is off the
      // login page is hidden from the public surface — bounce home so
      // we don't expose it.
      if (flagOn) {
        return redirectToLogin(request, path);
      }
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest, originalPath: string): NextResponse {
  const url = new URL("/login", request.url);
  url.searchParams.set("callbackUrl", originalPath);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/account/:path*", "/dashboard/coordinator/:path*"],
};
