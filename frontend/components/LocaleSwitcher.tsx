"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";

import { routing, usePathname, useRouter, type Locale } from "@/i18n/routing";

/**
 * Header dropdown to switch the active locale. Flag-gated by
 * `NEXT_PUBLIC_FEATURE_I18N`; per-locale flags
 * (`NEXT_PUBLIC_FEATURE_I18N_FR/DE/ES`) further gate which entries
 * appear so French can ship before German/Spanish are reviewed.
 *
 * Switching locales navigates to the equivalent URL on the new
 * locale, preserving the path. Default locale (en) lives at root
 * (`/species/123`); other locales prefix (`/fr/species/123`).
 *
 * Uses the locale-aware router and pathname helpers from
 * `@/i18n/routing` (NOT next/navigation) so:
 *   1. switching to a different locale updates the NEXT_LOCALE
 *      cookie so middleware doesn't bounce the user back.
 *   2. the destination URL is computed correctly per locale prefix
 *      mode (default = no prefix, others = /<locale>/...).
 */

const LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
};

const PER_LOCALE_FLAG_ENV: Record<Locale, string | undefined> = {
  en: undefined, // default; always available when master flag is on
  fr: process.env.NEXT_PUBLIC_FEATURE_I18N_FR,
  de: process.env.NEXT_PUBLIC_FEATURE_I18N_DE,
  es: process.env.NEXT_PUBLIC_FEATURE_I18N_ES,
};

function isLocaleEnabled(locale: Locale): boolean {
  if (locale === routing.defaultLocale) return true;
  return PER_LOCALE_FLAG_ENV[locale] === "true";
}

export default function LocaleSwitcher() {
  const flagOn = process.env.NEXT_PUBLIC_FEATURE_I18N === "true";
  const currentLocale = useLocale() as Locale;
  // pathname from @/i18n/routing returns the de-localized path
  // (`/species` even when the URL is `/fr/species`), which is what
  // router.replace expects when paired with a `locale` option.
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!flagOn) return null;

  const enabled = routing.locales.filter(isLocaleEnabled);
  // Don't render if only English is enabled (nothing to switch to).
  if (enabled.length <= 1) return null;

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const target = event.target.value as Locale;
    if (target === currentLocale) return;
    startTransition(() => {
      // The locale-aware router handles cookie update + locale prefix
      // construction. Pass the de-localized pathname; router computes
      // the right destination based on `routing.localePrefix`.
      router.replace(pathname, { locale: target });
    });
  }

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 14,
        color: "var(--ink-2)",
      }}
    >
      <span className="sr-only">Language</span>
      <select
        aria-label="Language"
        value={currentLocale}
        onChange={onChange}
        disabled={isPending}
        style={{
          appearance: "none",
          background: "transparent",
          border: "1px solid var(--rule)",
          borderRadius: 6,
          padding: "4px 8px",
          fontFamily: "var(--sans)",
          fontSize: 14,
          color: "var(--ink)",
          cursor: isPending ? "wait" : "pointer",
        }}
      >
        {enabled.map((locale) => (
          <option key={locale} value={locale}>
            {LABELS[locale]}
          </option>
        ))}
      </select>
    </label>
  );
}
