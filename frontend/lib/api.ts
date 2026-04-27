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
   * Server-only — never pass a token from a client component. Pass
   * `getServerSession(authOptions)?.drfToken` from a server component or
   * route handler when a tier-gated read is needed.
   *
   * If both `authToken` and an `Authorization` header in `headers` are
   * given, the explicit header wins (escape hatch for the existing
   * service-token path that uses `Authorization: Bearer <token>`).
   */
  authToken?: string;
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
  // If a caller has already set an Authorization header explicitly, respect
  // it — the existing service-token branch (`Bearer <token>`) goes through
  // here. Otherwise, use the optional `authToken` for the standard DRF
  // `Token <key>` shape.
  if (!options.authToken) {
    return options.headers;
  }
  const merged = new Headers(options.headers ?? {});
  if (!merged.has("Authorization")) {
    merged.set("Authorization", `Token ${options.authToken}`);
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
