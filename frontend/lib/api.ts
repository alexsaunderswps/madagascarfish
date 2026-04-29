const DEFAULT_REVALIDATE = Number(process.env.NEXT_REVALIDATE_SECONDS ?? 3600);

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiFetchOptions {
  revalidate?: number;
  headers?: HeadersInit;
  signal?: AbortSignal;
  /**
   * DRF auth token forwarded as `Authorization: Token <key>` (Gate 11).
   * Server-only — never pass a token from a client component. Use
   * `getServerDrfToken()` from `@/lib/auth` to read the token from the
   * session cookie inside a server component or route handler.
   *
   * NOTE: do NOT try to read `drfToken` off the NextAuth Session object.
   * The session callback in `lib/auth.ts` deliberately omits `drfToken`
   * because anything on `Session` is browser-readable via
   * `/api/auth/session`. `getServerDrfToken()` reads the JWT directly
   * via `next/headers` + `decodeJwt`, never crossing the session-
   * serialization path.
   *
   * If both `authToken` and an `Authorization` header in `headers` are
   * given, the explicit header wins (escape hatch for the existing
   * service-token path that uses `Authorization: Bearer <token>`).
   */
  authToken?: string;
  /**
   * Active locale (e.g. "en", "fr", "de", "es") forwarded as
   * `Accept-Language: <locale>` so Django's `LocaleMiddleware` resolves
   * the right language and modeltranslation returns the requested
   * locale's columns. Source on the server side from
   * `next-intl`'s `getLocale()` inside the page that invokes the
   * fetcher (Gate L1 i18n architect doc §9 R6 / S3).
   *
   * If both `locale` and an `Accept-Language` header in `headers` are
   * given, the explicit header wins.
   */
  locale?: string;
}

/**
 * Resolve the Django API base URL from `NEXT_PUBLIC_API_URL`. Strips
 * trailing slashes for clean concatenation. Exported so other modules
 * (e.g. `lib/auth.ts`'s NextAuth callbacks that POST to Django) reuse the
 * same env-var contract without duplicating the resolution logic.
 */
export function resolveBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Add it to .env.local (dev) or Vercel project env (preview/prod).",
    );
  }
  return base.replace(/\/$/, "");
}

function buildHeaders(options: ApiFetchOptions): HeadersInit | undefined {
  // Fast path: nothing to add, return whatever the caller provided
  // (possibly undefined).
  if (!options.authToken && !options.locale) {
    return options.headers;
  }
  // Compose. Explicit headers in `options.headers` always win — that's
  // the escape hatch for the service-token path (`Bearer <token>`) and
  // for tests that pin Accept-Language explicitly.
  const merged = new Headers(options.headers ?? {});
  if (options.authToken && !merged.has("Authorization")) {
    merged.set("Authorization", `Token ${options.authToken}`);
  }
  if (options.locale && !merged.has("Accept-Language")) {
    merged.set("Accept-Language", options.locale);
  }
  return merged;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const url = `${resolveBaseUrl()}${path}`;
  const revalidate = options.revalidate ?? DEFAULT_REVALIDATE;

  const response = await fetch(url, {
    headers: buildHeaders(options),
    signal: options.signal,
    next: { revalidate },
  });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      url,
      `API ${response.status} for ${path}`,
    );
  }

  return (await response.json()) as T;
}
