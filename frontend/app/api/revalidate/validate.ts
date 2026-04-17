export type ValidationResult =
  | { ok: true; paths: string[] }
  | { ok: false; reason: string };

export function validateRevalidateBody(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, reason: "body must be a JSON object" };
  }
  const raw = (body as { paths?: unknown }).paths;
  if (!Array.isArray(raw)) {
    return { ok: false, reason: "paths must be an array of strings" };
  }
  if (raw.length === 0) {
    return { ok: false, reason: "paths must contain at least one entry" };
  }
  if (raw.length > 50) {
    return { ok: false, reason: "paths is capped at 50 entries per request" };
  }
  const paths: string[] = [];
  for (const p of raw) {
    if (typeof p !== "string") {
      return { ok: false, reason: "each path must be a string" };
    }
    if (!p.startsWith("/")) {
      return { ok: false, reason: `path must start with "/": ${p}` };
    }
    if (p.includes("\n") || p.includes("\r")) {
      return { ok: false, reason: "path contains invalid whitespace" };
    }
    paths.push(p);
  }
  return { ok: true, paths };
}
