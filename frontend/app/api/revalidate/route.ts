import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { validateRevalidateBody } from "./validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extractSecret(req: Request, body: unknown): string | null {
  const header = req.headers.get("x-revalidate-secret");
  if (header) return header;
  if (body && typeof body === "object") {
    const bodySecret = (body as { secret?: unknown }).secret;
    if (typeof bodySecret === "string") return bodySecret;
  }
  return null;
}

export async function POST(req: Request) {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, reason: "server is not configured for revalidation" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid JSON body" },
      { status: 400 },
    );
  }

  const secret = extractSecret(req, body);
  if (!secret || secret !== expected) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const result = validateRevalidateBody(body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 });
  }

  const revalidated: string[] = [];
  const failures: Array<{ path: string; reason: string }> = [];
  for (const path of result.paths) {
    try {
      revalidatePath(path);
      revalidated.push(path);
    } catch (err) {
      failures.push({
        path,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (failures.length > 0 && revalidated.length === 0) {
    return NextResponse.json(
      { ok: false, revalidated, failures },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    revalidated,
    failures: failures.length > 0 ? failures : undefined,
  });
}
