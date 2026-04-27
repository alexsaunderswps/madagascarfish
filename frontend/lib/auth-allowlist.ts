/**
 * Open-redirect allow-list for `?callbackUrl=` and post-verify redirects
 * (Gate 11 — security checklist §13).
 *
 * Validates that a user-provided redirect target is same-origin to the
 * frontend, falling back to `/` when not. Prevents `?callbackUrl=https://evil.example`
 * from sending the user off-site after a successful login.
 */

const SAFE_DEFAULT = "/";

function frontendOrigin(): string | null {
  // NEXTAUTH_URL is the canonical frontend URL in any env where NextAuth
  // is configured. In dev it's set in .env.local; in prod/staging it's set
  // in the deploy environment. If absent, we treat all relative paths as
  // safe and reject anything else.
  const url = process.env.NEXTAUTH_URL;
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function safeRedirectTarget(input: string | null | undefined): string {
  if (!input) return SAFE_DEFAULT;
  // Always allow same-site relative paths like `/account` or `/dashboard/coordinator`.
  // Reject protocol-relative (`//evil.example`) which the browser treats as absolute.
  if (input.startsWith("/") && !input.startsWith("//")) {
    return input;
  }
  // Allow absolute URLs only when the origin matches NEXTAUTH_URL.
  const origin = frontendOrigin();
  if (origin) {
    try {
      const parsed = new URL(input);
      if (parsed.origin === origin) {
        return parsed.pathname + parsed.search + parsed.hash;
      }
    } catch {
      // Fall through to default.
    }
  }
  return SAFE_DEFAULT;
}
