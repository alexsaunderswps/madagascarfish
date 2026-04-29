import { defineRouting } from "next-intl/routing";

/**
 * Locale routing config. Drives middleware (URL prefix recognition),
 * the LocaleSwitcher's destination URLs, and `<Link>`/redirect helpers.
 *
 * `localePrefix: "as-needed"` keeps English at the root (`/species/123`)
 * and prefixes only non-default locales (`/fr/species/123`). This
 * preserves all existing inbound links — see
 * docs/planning/i18n/README.md D1.
 */
export const routing = defineRouting({
  locales: ["en", "fr", "de", "es"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
