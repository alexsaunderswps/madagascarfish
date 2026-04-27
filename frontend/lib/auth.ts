import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import { decode as decodeJwt } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { cookies } from "next/headers";

import { resolveBaseUrl } from "./api";

/**
 * NextAuth configuration for the Madagascar Freshwater Fish Conservation
 * Platform — Gate 11 MVP.
 *
 * Architecture: `docs/planning/architecture/auth-c-d.md`
 * Gate spec:    `docs/planning/specs/gate-11-auth-mvp.md`
 *
 * Shape:
 *   1. Credentials provider POSTs `{email, password}` to Django's
 *      `/api/v1/auth/login/`. Django returns `{token, access_tier, user_id}`.
 *      We map it into a NextAuth user object.
 *   2. The JWT callback persists `tier`, `drfToken`, and `tierFetchedAt` on
 *      the token. The DRF token NEVER leaves the JWT — it is not projected
 *      onto the session, because NextAuth's `/api/auth/session` route would
 *      then serialize it into the browser-visible response.
 *   3. After 5 minutes elapse on `tierFetchedAt`, the JWT callback re-fetches
 *      `/api/v1/auth/me/` to refresh the tier. A 401 (deactivated user, token
 *      invalidated) clears the session.
 *   4. The session callback projects ONLY `tier` onto the session — that's
 *      safe to be browser-visible because the API enforces tier server-side.
 *      Server components that need the DRF token call `getServerDrfToken(req)`
 *      below, which reads the JWT directly via `getToken({req})`.
 *
 * The 5-minute TTL is a deliberate trade between propagation latency for tier
 * changes and Django load. Architecture §4 locked it.
 */

const TIER_REFRESH_TTL_MS = 5 * 60 * 1000;
// Architecture §4 locks 30-day rolling, but BA cross-cutting + security
// review pushed back to ≤7 days because we lack a per-user revocation
// path other than `/me/` 401-on-401. 7 days is the BA constraint.
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
// Exported for unit tests so the TTL doesn't have to be hard-coded twice.
export const TIER_REFRESH_TTL_SECONDS = TIER_REFRESH_TTL_MS / 1000;

interface DjangoLoginResponse {
  token: string;
  access_tier: number;
  user_id: number;
}

interface DjangoMeResponse {
  email: string;
  name: string;
  access_tier: number;
}

export const authOptions: NextAuthOptions = {
  // JWT-mode session — required because we don't run a session DB and
  // because the DRF token must live on the JWT, not in browser-readable
  // session storage.
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        const response = await fetch(`${resolveBaseUrl()}/api/v1/auth/login/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
          // Anonymous outbound — no cookies, no caching of failed attempts.
          cache: "no-store",
        });

        // 401 (bad credentials) and 429 (rate limited) both surface as
        // identical generic UI signals. Returning null lets NextAuth render
        // the same "Invalid email or password" copy for both, preserving the
        // account-enumeration resistance Django already enforces.
        if (!response.ok) {
          return null;
        }
        const data = (await response.json()) as DjangoLoginResponse;
        return {
          // NextAuth's `user.id` must be a string.
          id: String(data.user_id),
          email: credentials.email,
          tier: data.access_tier,
          drfToken: data.token,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // First sign-in — `user` is populated by `authorize()`. Persist what we
      // need on the JWT so the session callback (and SSR fetches) can read
      // them.
      if (user) {
        const u = user as typeof user & { tier?: number; drfToken?: string };
        if (typeof u.tier === "number") token.tier = u.tier;
        if (typeof u.drfToken === "string") token.drfToken = u.drfToken;
        token.tierFetchedAt = Date.now();
        return token;
      }
      // Subsequent requests — refresh the tier from `/me/` if the TTL has
      // expired. Extracted for testability — see `auth.test.ts`.
      return refreshTierIfStale(token);
    },

    async session({ session, token }) {
      // SECURITY: project ONLY `tier` onto the session. NextAuth's
      // `/api/auth/session` endpoint serializes whatever this callback
      // returns and exposes it to client components via `useSession()`.
      // Putting `drfToken` here would leak the credential to the browser.
      // Server components that need the DRF token must read the JWT
      // directly via `getServerDrfToken()` below.
      if (typeof token.tier === "number") {
        session.tier = token.tier;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
};

/**
 * Refresh `token.tier` from Django `/me/` when the cached value is older
 * than `TIER_REFRESH_TTL_MS`. Pure function over `JWT` so unit tests can
 * mock `fetch` and assert the four branches independently:
 *
 *   - fresh: returns token unchanged (no fetch issued)
 *   - stale + 200: updates `tier` + `tierFetchedAt`
 *   - stale + 401: returns `{}` to force re-login
 *   - stale + 5xx / network error: returns token unchanged (don't sign
 *     everyone out on a transient Django blip)
 */
export async function refreshTierIfStale<
  T extends { tier?: number; drfToken?: string; tierFetchedAt?: number },
>(token: T): Promise<T> {
  const fetchedAt = typeof token.tierFetchedAt === "number" ? token.tierFetchedAt : 0;
  if (Date.now() - fetchedAt <= TIER_REFRESH_TTL_MS) {
    return token;
  }
  if (typeof token.drfToken !== "string") {
    return token;
  }
  try {
    const r = await fetch(`${resolveBaseUrl()}/api/v1/auth/me/`, {
      headers: { Authorization: `Token ${token.drfToken}` },
      cache: "no-store",
    });
    if (r.status === 401) {
      // Returning {} clears all custom fields; `getServerSession` returns
      // null on the next request and the user is forced to /login.
      return {} as T;
    }
    if (r.ok) {
      const me = (await r.json()) as DjangoMeResponse;
      token.tier = me.access_tier;
      token.tierFetchedAt = Date.now();
    }
  } catch {
    // Network-down should not log everyone out — keep the cached tier.
  }
  return token;
}

// NextAuth's session-cookie name depends on `secure`-mode (prod uses the
// `__Secure-` prefix). Read both — first hit wins.
const SESSION_COOKIE_NAMES = [
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];

/**
 * Server-only accessor for the DRF token associated with the current
 * request's session. Reads the JWT directly from the session cookie via
 * `next/headers`, then decodes it with `NEXTAUTH_SECRET`. The token never
 * traverses the session-callback → JSON serialization path that
 * NextAuth's `/api/auth/session` endpoint exposes to the browser.
 *
 * Call only from server components, route handlers, or server actions —
 * `next/headers` throws in a client context.
 */
export async function getServerDrfToken(): Promise<string | undefined> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return undefined;
  const jar = cookies();
  let raw: string | undefined;
  for (const name of SESSION_COOKIE_NAMES) {
    const c = jar.get(name);
    if (c?.value) {
      raw = c.value;
      break;
    }
  }
  if (!raw) return undefined;
  try {
    const decoded = await decodeJwt({ token: raw, secret });
    if (!decoded) return undefined;
    const drf = (decoded as { drfToken?: unknown }).drfToken;
    return typeof drf === "string" ? drf : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Convenience server-side wrapper: returns just the tier (browser-safe)
 * without exposing the DRF token. Used by page components that need to
 * make a tier-aware decision but don't fetch on behalf of the user.
 */
export async function getServerTier(): Promise<number | undefined> {
  const session = await getServerSession(authOptions);
  return session?.tier;
}
