import { getTranslations } from "next-intl/server";
import Link from "next/link";

import SignupForm from "./SignupForm";

export async function generateMetadata() {
  const t = await getTranslations("auth.signup");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function SignupPage() {
  const t = await getTranslations("auth");
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <header className="mb-8">
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          {t("accountEyebrow")}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-slate-900">
          {t("signup.title")}
        </h1>
        <p className="mt-3 text-sm text-slate-600">{t("signup.subtitle")}</p>
      </header>

      <SignupForm />

      <p className="mt-6 text-sm text-slate-600">
        {t("signup.haveAccountPrefix")}{" "}
        <Link href="/login" className="text-sky-700 hover:underline">
          {t("signup.loginLink")}
        </Link>
        .
      </p>
    </main>
  );
}
