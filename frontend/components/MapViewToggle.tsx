import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";

export type MapView = "map" | "list";

function buildHref(
  base: string,
  currentParams: Record<string, string | string[] | undefined>,
  nextView: MapView,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(currentParams)) {
    if (k === "view") continue;
    if (v == null) continue;
    if (Array.isArray(v)) {
      for (const item of v) params.append(k, item);
    } else {
      params.set(k, v);
    }
  }
  if (nextView === "list") {
    params.set("view", "list");
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export default function MapViewToggle({
  current,
  searchParams,
}: {
  current: MapView;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = useTranslations("map.view");
  const mapHref = buildHref("/map/", searchParams, "map");
  const listHref = buildHref("/map/", searchParams, "list");

  const activeStyle = {
    minHeight: 44,
    padding: "10px 16px",
    display: "inline-flex",
    alignItems: "center",
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "var(--accent-2)",
    textDecoration: "none",
  } as const;
  const inactiveStyle = {
    minHeight: 44,
    padding: "10px 16px",
    display: "inline-flex",
    alignItems: "center",
    fontSize: 13,
    fontWeight: 500,
    color: "var(--ink-2)",
    backgroundColor: "var(--bg)",
    textDecoration: "none",
  } as const;

  return (
    <div
      role="group"
      aria-label={t("ariaLabel")}
      style={{
        display: "inline-flex",
        overflow: "hidden",
        borderRadius: "var(--radius)",
        border: "1px solid var(--rule-strong)",
      }}
    >
      <Link
        href={mapHref}
        aria-current={current === "map" ? "page" : undefined}
        prefetch={false}
        style={current === "map" ? activeStyle : inactiveStyle}
      >
        {t("map")}
      </Link>
      <Link
        href={listHref}
        aria-current={current === "list" ? "page" : undefined}
        prefetch={false}
        style={current === "list" ? activeStyle : inactiveStyle}
      >
        {t("viewAsList")}
      </Link>
    </div>
  );
}

export { buildHref as _buildHrefForTesting };
