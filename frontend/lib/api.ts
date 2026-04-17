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
}

function resolveBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Add it to .env.local (dev) or Vercel project env (preview/prod).",
    );
  }
  return base.replace(/\/$/, "");
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const url = `${resolveBaseUrl()}${path}`;
  const revalidate = options.revalidate ?? DEFAULT_REVALIDATE;

  const response = await fetch(url, {
    headers: options.headers,
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
