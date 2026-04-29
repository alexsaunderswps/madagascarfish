import Link from "next/link";
import { redirect } from "next/navigation";

import { resolveBaseUrl } from "@/lib/api";

export const metadata = {
  title: "Verify your account — Madagascar Freshwater Fish",
  description: "Activate your account by verifying the email link.",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams?: Promise<{ token?: string }>;
}

type VerifyOutcome = "success" | "missing-token" | "invalid-or-expired" | "transient-error";

async function verifyToken(token: string): Promise<VerifyOutcome> {
  let response: Response;
  try {
    response = await fetch(`${resolveBaseUrl()}/api/v1/auth/verify/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
  } catch {
    return "transient-error";
  }
  if (response.ok) {
    return "success";
  }
  if (response.status === 400) {
    return "invalid-or-expired";
  }
  return "transient-error";
}

export default async function VerifyPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const token = params.token;

  let outcome: VerifyOutcome;
  if (!token) {
    outcome = "missing-token";
  } else {
    outcome = await verifyToken(token);
  }

  if (outcome === "success") {
    redirect("/login?verified=1");
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <header className="mb-6">
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Account
        </p>
        <h1 className="mt-2 font-serif text-3xl text-slate-900">
          Verification link
        </h1>
      </header>

      {outcome === "missing-token" ? (
        <div
          role="status"
          className="rounded border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900"
        >
          <p className="font-medium">This link is missing its verification token.</p>
          <p className="mt-2">
            Open the link directly from your verification email — the URL
            should end with <code className="px-1">?token=…</code>. If your
            email client truncated the link, you can{" "}
            <Link href="/signup" className="text-sky-700 hover:underline">
              register again
            </Link>{" "}
            to receive a fresh one.
          </p>
        </div>
      ) : null}

      {outcome === "invalid-or-expired" ? (
        <div
          role="status"
          className="rounded border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900"
        >
          <p className="font-medium">This verification link is no longer valid.</p>
          <p className="mt-2">
            Links expire 48 hours after sign-up, and each link can only be
            used once. To finish creating your account,{" "}
            <Link href="/signup" className="text-sky-700 hover:underline">
              register again
            </Link>{" "}
            and we&rsquo;ll send a new link to your email.
          </p>
        </div>
      ) : null}

      {outcome === "transient-error" ? (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700"
        >
          <p className="font-medium">We couldn&rsquo;t verify your account just now.</p>
          <p className="mt-2">
            The verification service is temporarily unreachable. Try the link
            again in a few minutes. If it keeps failing, the platform team
            can verify your account manually — contact details are on the{" "}
            <Link href="/about/" className="text-sky-700 hover:underline">
              About page
            </Link>
            .
          </p>
        </div>
      ) : null}
    </main>
  );
}
