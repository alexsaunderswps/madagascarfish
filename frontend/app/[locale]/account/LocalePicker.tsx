"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useState, useTransition } from "react";

import { updateLocaleAction } from "./actions";

const LOCALE_OPTIONS = [
  { value: "en", labelKey: "english" },
  { value: "fr", labelKey: "french" },
  { value: "de", labelKey: "german" },
  { value: "es", labelKey: "spanish" },
] as const;

type LocaleValue = (typeof LOCALE_OPTIONS)[number]["value"];

/**
 * Self-serve locale-preference picker on /account (L4 S9).
 *
 * Updates User.locale via PATCH /api/v1/auth/me/locale/. That field
 * drives email locale (S8) and is the architecture-§13.7 follow-up to
 * the User.locale field shipped in S7.
 *
 * The picker also navigates the user into the chosen locale's URL
 * prefix so the change is immediately visible in the UI — otherwise
 * the next page would still render in the old locale until the
 * NEXT_LOCALE cookie cycles.
 */
export default function LocalePicker({ initialLocale }: { initialLocale: string }) {
  const t = useTranslations("account.localePicker");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [value, setValue] = useState<LocaleValue>(
    (LOCALE_OPTIONS.find((o) => o.value === initialLocale)?.value ?? "en") as LocaleValue,
  );

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as LocaleValue;
    setValue(next);
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateLocaleAction(next);
      if (!result.ok) {
        setError(t("error"));
        return;
      }
      setSuccess(true);
      // Switch the active UI locale so the change takes effect now.
      router.replace("/account", { locale: next });
      router.refresh();
    });
  }

  return (
    <div>
      <label
        htmlFor="account-locale-picker"
        className="text-xs font-medium uppercase tracking-wider text-slate-500"
      >
        {t("label")}
      </label>
      <select
        id="account-locale-picker"
        value={value}
        onChange={handleChange}
        disabled={pending}
        className="mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60"
      >
        {LOCALE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {t(opt.labelKey)}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-slate-500">{t("help")}</p>
      {pending ? (
        <p className="mt-1 text-xs text-slate-500" aria-live="polite">
          {t("saving")}
        </p>
      ) : null}
      {success ? (
        <p className="mt-1 text-xs text-emerald-700" aria-live="polite">
          {t("saved")}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
