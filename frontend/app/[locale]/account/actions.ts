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

const ALLOWED_LOCALES = new Set(["en", "fr", "de", "es"]);

export type UpdateLocaleResult = { ok: true } | { ok: false; reason: string };

/**
 * Server-side half of the /account locale-picker (S9). PATCHes the
 * authenticated user's preferred locale to Django; the field drives email
 * locale in S8 and the default UI locale on first visit (architecture §13.7).
 *
 * Locale validation is server-side: the browser may send anything, we
 * accept only the four whitelisted codes.
 */
export async function updateLocaleAction(
  locale: string,
): Promise<UpdateLocaleResult> {
  if (!ALLOWED_LOCALES.has(locale)) {
    return { ok: false, reason: "invalid_locale" };
  }
  const drfToken = await getServerDrfToken();
  if (!drfToken) {
    return { ok: false, reason: "unauthenticated" };
  }
  try {
    const response = await fetch(`${resolveBaseUrl()}/api/v1/auth/me/locale/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${drfToken}`,
      },
      body: JSON.stringify({ locale }),
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, reason: "server_error" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}
