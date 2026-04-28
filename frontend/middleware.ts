import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Gate 11 middleware — auth guards for protected routes.
 *
 * Behavior:
 *   1. If `NEXT_PUBLIC_FEATURE_AUTH` is not "true", pass through unchanged.
 *      This preserves the rollback property — flipping the flag off in
 *      Vercel env immediately restores the pre-Gate-11 behavior with no
 *      code revert.
 *   2. `/account/*`: requires a valid NextAuth session. No session →
 *      redirect to `/login?callbackUrl=<original-path>`. The callbackUrl
 *      is always a same-origin path, which `safeRedirectTarget` accepts.
 *   3. `/dashboard/coordinator/*`: requires either a session OR the
 *      service token (`COORDINATOR_API_TOKEN`). If neither is present,
 *      redirect to `/login?callbackUrl=…`. If either is present, let SSR
 *      run and let the API decide tier — the architecture pattern.
 *
 * The matcher in `config` keeps middleware off the public surface.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const flagOn = process.env.NEXT_PUBLIC_FEATURE_AUTH === "true";
  if (!flagOn) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const path = request.nextUrl.pathname;

  if (path.startsWith("/account")) {
    if (!token) {
      return redirectToLogin(request, path);
    }
    return NextResponse.next();
  }

  if (path.startsWith("/dashboard/coordinator")) {
    const hasServiceToken = Boolean(process.env.COORDINATOR_API_TOKEN);
    if (!token && !hasServiceToken) {
      return redirectToLogin(request, path);
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
