import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

import LoginForm from "./LoginForm";

export async function generateMetadata() {
  const t = await getTranslations("auth.login");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

interface PageProps {
  searchParams?: Promise<{ callbackUrl?: string; verified?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const verified = params.verified === "1";
  const t = await getTranslations("auth");

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <header className="mb-8">
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          {t("accountEyebrow")}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-slate-900">
          {t("login.title")}
        </h1>
        <p className="mt-3 text-sm text-slate-600">{t("login.subtitle")}</p>
      </header>

      {verified ? (
        <div
          role="status"
          className="mb-6 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {t("login.verifiedBanner")}
        </div>
      ) : null}

      <LoginForm />

      <p className="mt-6 text-sm text-slate-600">
        {t("login.newToPlatformPrefix")}{" "}
        <Link href="/signup" className="text-sky-700 hover:underline">
          {t("login.createAccountLink")}
        </Link>
        .
      </p>
    </main>
  );
}
