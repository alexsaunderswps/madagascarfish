import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/**
 * Resolves messages for the active locale at request time. Called by
 * `getTranslations()` (server) and the `<NextIntlClientProvider>` setup
 * in `app/[locale]/layout.tsx`.
 *
 * Falls back to the default locale (en) if the requested locale isn't
 * one we support. Per-locale message catalogs live in
 * `frontend/messages/<locale>.json`.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale =
    requested && (routing.locales as readonly string[]).includes(requested)
      ? requested
      : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
