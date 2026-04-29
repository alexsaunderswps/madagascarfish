import { createNavigation } from "next-intl/navigation";
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

/**
 * Locale-aware navigation primitives. Use these in client components
 * (LocaleSwitcher, locale-aware <Link>s) instead of next/navigation's
 * raw exports — they understand the routing config above and:
 *
 *   - construct destination paths with the right locale prefix
 *     (or no prefix, for the default locale)
 *   - update the `NEXT_LOCALE` cookie when the target locale differs,
 *     so subsequent middleware passes don't bounce the user back to
 *     the previous cookie's locale.
 *
 * Without these, switching from a non-default locale back to English
 * appears to "stick" because the cookie still says fr/de/es and the
 * middleware re-applies it on the next request.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
