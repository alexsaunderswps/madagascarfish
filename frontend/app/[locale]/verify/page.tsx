import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { resolveBaseUrl } from "@/lib/api";

export async function generateMetadata() {
  const t = await getTranslations("auth.verify");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

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

  const t = await getTranslations("auth");

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <header className="mb-6">
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          {t("accountEyebrow")}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-slate-900">
          {t("verify.title")}
        </h1>
      </header>

      {outcome === "missing-token" ? (
        <div
          role="status"
          className="rounded border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900"
        >
          <p className="font-medium">{t("verify.missingToken.title")}</p>
          <p className="mt-2">
            {t("verify.missingToken.bodyPrefix")}{" "}
            <code className="px-1">{t("verify.missingToken.bodyTokenExample")}</code>
            {t("verify.missingToken.bodyMiddle")}{" "}
            <Link href="/signup" className="text-sky-700 hover:underline">
              {t("verify.missingToken.registerLink")}
            </Link>{" "}
            {t("verify.missingToken.bodySuffix")}
          </p>
        </div>
      ) : null}

      {outcome === "invalid-or-expired" ? (
        <div
          role="status"
          className="rounded border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900"
        >
          <p className="font-medium">{t("verify.expired.title")}</p>
          <p className="mt-2">
            {t("verify.expired.bodyPrefix")}{" "}
            <Link href="/signup" className="text-sky-700 hover:underline">
              {t("verify.expired.registerLink")}
            </Link>{" "}
            {t("verify.expired.bodySuffix")}
          </p>
        </div>
      ) : null}

      {outcome === "transient-error" ? (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700"
        >
          <p className="font-medium">{t("verify.transient.title")}</p>
          <p className="mt-2">
            {t("verify.transient.bodyPrefix")}{" "}
            <Link href="/about/" className="text-sky-700 hover:underline">
              {t("verify.transient.aboutLink")}
            </Link>
            {t("verify.transient.bodySuffix")}
          </p>
        </div>
      ) : null}
    </main>
  );
}
