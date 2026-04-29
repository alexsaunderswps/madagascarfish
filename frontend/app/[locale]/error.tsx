"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <div
        role="status"
        aria-label={t("ariaLabel")}
        className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center"
      >
        <h2 className="font-serif text-xl text-slate-900">{t("title")}</h2>
        <p className="mt-2 text-sm text-slate-600">{t("subtitle")}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
          >
            {t("tryAgain")}
          </button>
          <a
            href="/"
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t("homeLink")}
          </a>
        </div>
      </div>
    </main>
  );
}
