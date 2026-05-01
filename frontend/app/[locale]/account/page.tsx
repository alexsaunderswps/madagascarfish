import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ApiError, apiFetch } from "@/lib/api";
import { getServerDrfToken } from "@/lib/auth";
import type { MeResponse } from "@/lib/me";

import LocalePicker from "./LocalePicker";
import LogoutButton from "./LogoutButton";

export async function generateMetadata() {
  const t = await getTranslations("account");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export const dynamic = "force-dynamic";


export default async function AccountPage() {
  const drfToken = await getServerDrfToken();
  if (!drfToken) {
    redirect("/login?callbackUrl=/account");
  }

  // Use apiFetch with the session token rather than a raw fetch — keeps
  // this page's auth-forwarding pattern aligned with the rest of the
  // codebase, so future tier-restricted pages copying from /account
  // pick up the canonical pattern. revalidate:0 (Gate 11 cache-poisoning
  // rule: any authToken'd fetch must bypass Next's shared fetch cache).
  let me: MeResponse | null = null;
  let transientError = false;
  try {
    me = await apiFetch<MeResponse>("/api/v1/auth/me/", {
      authToken: drfToken,
      revalidate: 0,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // Stale or revoked token; force re-login.
      redirect("/login?callbackUrl=/account");
    }
    transientError = true;
  }

  const [t, tAuth] = await Promise.all([
    getTranslations("account"),
    getTranslations("auth"),
  ]);

  const tierLabel = me
    ? // The catalog has tier strings keyed "1"..."5"; fall back to "Member".
      // next-intl's t("tiers.X") throws on missing key, so we look up via
      // try/catch behavior — simpler: pre-list valid keys.
      ["1", "2", "3", "4", "5"].includes(String(me.access_tier))
      ? t(`tiers.${me.access_tier}`)
      : t("tiers.fallback")
    : null;

  const tierDescription =
    me && ["1", "2", "3", "4", "5"].includes(String(me.access_tier))
      ? t(`tierDescriptions.${me.access_tier}`)
      : null;

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <header className="mb-8">
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          {tAuth("accountEyebrow")}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-slate-900">{t("title")}</h1>
      </header>

      {me ? (
        <dl className="space-y-4 rounded border border-slate-200 bg-white p-4 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {t("nameLabel")}
            </dt>
            <dd className="mt-1 text-slate-900">{me.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {t("emailLabel")}
            </dt>
            <dd className="mt-1 text-slate-900">{me.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {t("tierLabel")}
            </dt>
            <dd className="mt-1 space-y-2">
              <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800">
                {t("tierBadge", { label: tierLabel ?? "", tier: me.access_tier })}
              </span>
              {tierDescription ? (
                <p className="text-xs leading-relaxed text-slate-600">
                  {tierDescription}
                </p>
              ) : null}
              {me.access_tier < 3 ? (
                <p className="text-xs leading-relaxed text-slate-500">
                  {t("tierUpgradeHint")}
                </p>
              ) : null}
            </dd>
          </div>
        </dl>
      ) : null}

      {me?.institution_membership &&
      me.institution_membership.claim_status !== "none" ? (
        <section className="mt-6 rounded border border-slate-200 bg-white p-4 text-sm">
          <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {t("institutionMembership.heading")}
          </h2>
          {(() => {
            const m = me.institution_membership;
            if (!m) return null;
            if (m.claim_status === "approved") {
              return (
                <div className="mt-2 space-y-1">
                  <p className="text-slate-900">
                    {t("institutionMembership.approved", {
                      name: m.institution_name ?? "",
                    })}
                  </p>
                  <a
                    href="/dashboard/institution"
                    className="inline-block text-sm text-sky-700 underline underline-offset-2 hover:text-sky-900"
                  >
                    {t("institutionMembership.openDashboard")}
                  </a>
                </div>
              );
            }
            if (m.claim_status === "pending") {
              return (
                <p className="mt-2 text-slate-700">
                  {t("institutionMembership.pending", {
                    name: m.institution_name ?? "",
                  })}
                </p>
              );
            }
            if (m.claim_status === "rejected") {
              return (
                <div className="mt-2 space-y-2">
                  <p className="text-slate-700">
                    {t("institutionMembership.rejected", {
                      name: m.institution_name ?? "",
                    })}
                  </p>
                  {m.rejection_reason ? (
                    <p className="rounded bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      <span className="font-semibold">
                        {t("institutionMembership.reasonLabel")}
                      </span>{" "}
                      {m.rejection_reason}
                    </p>
                  ) : null}
                </div>
              );
            }
            if (m.claim_status === "withdrawn") {
              return (
                <p className="mt-2 text-slate-700">
                  {t("institutionMembership.withdrawn", {
                    name: m.institution_name ?? "",
                  })}
                </p>
              );
            }
            return null;
          })()}
        </section>
      ) : null}

      {me ? (
        <div className="mt-6 rounded border border-slate-200 bg-white p-4">
          <LocalePicker initialLocale={me.locale ?? "en"} />
        </div>
      ) : null}

      {transientError ? (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {t("transientError")}
        </p>
      ) : null}

      <div className="mt-8">
        <LogoutButton />
      </div>
    </main>
  );
}
