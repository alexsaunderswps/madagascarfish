/**
 * Regression test for L4 S10: per-locale feature-flag gating logic on
 * the LocaleSwitcher. Tests the pure helpers exported from
 * LocaleSwitcher.tsx (no DOM rendering — that requires jsdom +
 * @testing-library/react which the project doesn't carry).
 *
 * Verifies:
 *  - Master flag off → no locales available regardless of per-locale flags.
 *  - Master flag on, all per-locale flags off → no locales (only en, can't switch).
 *  - Master flag on + FR flag on → en + fr only.
 *  - Master flag on + all flags on → all four locales.
 *  - isLocaleEnabled honors NEXT_PUBLIC_FEATURE_I18N_<LOCALE>="true" exactly.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/routing", async () => {
  return {
    routing: {
      defaultLocale: "en",
      locales: ["en", "fr", "de", "es"] as const,
      localePrefix: "as-needed" as const,
    },
    usePathname: () => "/",
    useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  };
});

vi.mock("next-intl", () => ({
  useLocale: () => "en",
}));

import { enabledSwitcherLocales, isLocaleEnabled } from "./LocaleSwitcher";

describe("isLocaleEnabled", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("always enables the default locale (en)", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_I18N_FR", "false");
    expect(isLocaleEnabled("en")).toBe(true);
  });

  it("enables fr only when NEXT_PUBLIC_FEATURE_I18N_FR === 'true'", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_I18N_FR", "true");
    expect(isLocaleEnabled("fr")).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_FEATURE_I18N_FR", "false");
    expect(isLocaleEnabled("fr")).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_FEATURE_I18N_FR", "");
    expect(isLocaleEnabled("fr")).toBe(false);
  });
});

describe("enabledSwitcherLocales", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns no locales when master flag is off", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_I18N", "false");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_I18N_FR", "true");
    expect(enabledSwitcherLocales()).toEqual([]);
  });

  it("returns no locales when only English is enabled (no switch target)", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_I18N", "true");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_I18N_FR", "false");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_I18N_DE", "false");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_I18N_ES", "false");
    expect(enabledSwitcherLocales()).toEqual([]);
  });

  it("returns en + fr only when only FR per-locale flag is on", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_I18N", "true");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_I18N_FR", "true");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_I18N_DE", "false");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_I18N_ES", "false");
    expect(enabledSwitcherLocales()).toEqual(["en", "fr"]);
  });

  it("returns all four locales when every flag is on", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_I18N", "true");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_I18N_FR", "true");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_I18N_DE", "true");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_I18N_ES", "true");
    expect(enabledSwitcherLocales()).toEqual(["en", "fr", "de", "es"]);
  });
});
