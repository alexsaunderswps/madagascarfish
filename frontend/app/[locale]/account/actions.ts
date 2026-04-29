"use server";

import { resolveBaseUrl } from "@/lib/api";
import { getServerDrfToken } from "@/lib/auth";

/**
 * Server-side half of the Logout flow (Gate 11 — BA cross-cutting).
 *
 * POSTs to Django `/api/v1/auth/logout/` carrying the user's DRF token so
 * Django can delete the row from the `authtoken_token` table. The DRF token
 * is read from the session cookie via `getServerDrfToken()` — it is never
 * passed in from the browser.
 *
 * The browser-side half (clearing the NextAuth cookie via `signOut()`)
 * fires from the client component regardless of this result. A 5xx or
 * network failure here is logged but not rethrown: the user-visible logout
 * (cookie clear) must succeed even when Django is briefly unreachable, and
 * the DRF token will eventually expire on its own.
 */
export async function djangoLogoutAction(): Promise<{ ok: boolean }> {
  const drfToken = await getServerDrfToken();
  if (!drfToken) {
    return { ok: true };
  }
  try {
    const response = await fetch(`${resolveBaseUrl()}/api/v1/auth/logout/`, {
      method: "POST",
      headers: { Authorization: `Token ${drfToken}` },
      cache: "no-store",
    });
    return { ok: response.ok };
  } catch {
    return { ok: false };
  }
}
