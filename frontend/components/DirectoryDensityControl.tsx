"use client";

/**
 * DirectoryDensityControl — S19 comfortable / compact density toggle.
 *
 * URL-backed: writes ?d=comfortable|compact and lets the server component
 * re-render. Unrecognized values fall back to comfortable (parseDensity).
 *
 * Locale-aware: uses the locale-aware router so density toggles preserve
 * the active locale prefix (a user on /fr/species stays on /fr/species).
 */

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { useRouter } from "@/i18n/routing";
import SegmentedControl from "./SegmentedControl";
import type { DirectoryDensity } from "@/lib/species";

export default function DirectoryDensityControl({
  density,
}: {
  density: DirectoryDensity;
}) {
  const t = useTranslations("species.directory.density");
  const router = useRouter();
  const searchParams = useSearchParams();

  const onChange = (next: DirectoryDensity) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "comfortable") params.delete("d");
    else params.set("d", next);
    const qs = params.toString();
    router.push(qs ? `/species/?${qs}` : "/species/");
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-3)",
        }}
      >
        {t("label")}
      </span>
      <SegmentedControl<DirectoryDensity>
        ariaLabel={t("ariaLabel")}
        value={density}
        onChange={onChange}
        options={[
          { value: "comfortable", label: t("comfortable") },
          { value: "compact", label: t("compact") },
        ]}
      />
    </div>
  );
}
