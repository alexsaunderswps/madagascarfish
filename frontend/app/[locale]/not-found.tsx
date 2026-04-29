import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

import EmptyState from "@/components/EmptyState";

export async function generateMetadata() {
  const t = await getTranslations("errors.notFound");
  return { title: t("metaTitle") };
}

export default async function NotFound() {
  const t = await getTranslations("errors.notFound");
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <EmptyState
        title={t("title")}
        body={t("body")}
        primaryAction={{ href: "/", label: t("homeLink") }}
        secondaryAction={{ href: "/species/", label: t("browseAll") }}
      />
      <p className="mt-6 text-center text-sm text-slate-500">
        {t("directoryHintPrefix")}{" "}
        <Link
          href="/species/"
          className="text-sky-700 underline underline-offset-2 hover:text-sky-900"
        >
          {t("directoryHintLink")}
        </Link>
      </p>
    </main>
  );
}
