import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import nextDynamic from "next/dynamic";

import EmptyState from "@/components/EmptyState";
import MapListView from "@/components/MapListView";
import MapViewToggle, { type MapView } from "@/components/MapViewToggle";
import type { Locale } from "@/i18n/routing";
import { getServerDrfToken } from "@/lib/auth";
import { fetchLocalities } from "@/lib/mapLocalities";
import { buildAlternates } from "@/lib/seo";

// Gate 11: must render dynamically because the page now reads the session
// to decide whether to forward Authorization on the locality fetch. ISR
// would cache one user's response (potentially exact coordinates) and
// replay it to anonymous visitors. The fetch-level revalidate=0 in
// `fetchLocalities` is defense-in-depth; this is the primary gate.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "map" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: buildAlternates("/map", locale),
  };
}

const MapClient = nextDynamic(() => import("@/components/MapClient"), {
  ssr: false,
  // Loading-state copy intentionally hardcoded English. next/dynamic's
  // loading is rendered before the route's i18n provider is available
  // and the spinner is on screen for ~1s in dev — translating it would
  // require a server-component wrapper. Acceptable visual tradeoff for
  // L1; revisit if it becomes a polish item.
  loading: () => (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "calc(100vh - 8rem)",
        minHeight: 500,
        width: "100%",
        backgroundColor: "var(--bg-sunken)",
        color: "var(--ink-3)",
        fontSize: 14,
      }}
    >
      Loading distribution map…
    </div>
  ),
});

export default async function MapPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const speciesIdRaw = searchParams.species_id;
  const speciesId = Array.isArray(speciesIdRaw) ? speciesIdRaw[0] : speciesIdRaw;

  const viewRaw = searchParams.view;
  const viewParam = Array.isArray(viewRaw) ? viewRaw[0] : viewRaw;
  const view: MapView = viewParam === "list" ? "list" : "map";

  // Gate 11: forward the logged-in user's DRF token so the backend's
  // SpeciesLocality serializer can serve exact coordinates to Tier 3+
  // visitors. Anonymous SSR sends nothing and gets the existing
  // generalized-coordinate behavior. The fetcher itself sets revalidate=0
  // when a token is present, so authenticated responses are never cached.
  const authToken = await getServerDrfToken();
  const [data, t] = await Promise.all([
    fetchLocalities(
      speciesId ? { species_id: speciesId } : {},
      { authToken },
    ),
    getTranslations("map"),
  ]);

  if (!data) {
    return (
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "64px 24px",
        }}
      >
        <EmptyState
          title={t("emptyStateBackendDown.title")}
          body={t("emptyStateBackendDown.body")}
          primaryAction={{ href: "/map/", label: t("emptyStateBackendDown.tryAgain") }}
          secondaryAction={{ href: "/species/", label: t("emptyStateBackendDown.browseAll") }}
        />
      </main>
    );
  }

  if (data.features.length === 0) {
    return (
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "64px 24px",
        }}
      >
        <EmptyState
          title={t("emptyStateNoRecords.title")}
          body={
            speciesId
              ? t("emptyStateNoRecords.bodyForSpecies")
              : t("emptyStateNoRecords.bodyAll")
          }
          primaryAction={{ href: "/species/", label: t("emptyStateNoRecords.browseAll") }}
        />
      </main>
    );
  }

  const focusLocalityRaw = searchParams.focus_locality;
  const focusLocalityId = Array.isArray(focusLocalityRaw) ? focusLocalityRaw[0] : focusLocalityRaw;

  const filterSpeciesName = speciesId
    ? data.features[0]?.properties.scientific_name ?? null
    : null;

  const clearHref = view === "list" ? "/map/?view=list" : "/map/";
  const count = data.features.length;

  return (
    <main>
      <h1 className="sr-only">{t("title")}</h1>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 24px",
          borderBottom: "1px solid var(--rule)",
          backgroundColor: "var(--bg-raised)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 16,
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: "var(--sans)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
            }}
          >
            {t("eyebrow")}
          </p>
          <span
            style={{
              fontSize: 13,
              color: "var(--ink-2)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {t("recordCount", { count })}
          </span>
          {speciesId ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 12,
                color: "var(--ink)",
                backgroundColor:
                  "color-mix(in oklab, var(--accent-2) 10%, var(--bg))",
                border:
                  "1px solid color-mix(in oklab, var(--accent-2) 30%, var(--rule))",
              }}
            >
              <span>
                {t.rich("filteredTo", {
                  name: filterSpeciesName ?? t("filterFallbackName", { id: speciesId }),
                  em: (chunks) => (
                    <em style={{ fontWeight: 600, fontStyle: "normal" }}>{chunks}</em>
                  ),
                })}
              </span>
              <a
                href={clearHref}
                aria-label={t("clearFilterAriaLabel")}
                style={{
                  fontWeight: 600,
                  color: "var(--accent-2)",
                  textDecoration: "none",
                  borderBottom:
                    "1px solid color-mix(in oklab, var(--accent-2) 35%, transparent)",
                }}
              >
                {t("clearFilter")}
              </a>
            </span>
          ) : null}
        </div>
        <MapViewToggle current={view} searchParams={searchParams} />
      </div>
      <p
        id="map-keyboard-hint"
        style={{
          margin: 0,
          padding: "8px 24px",
          fontSize: 12,
          color: "var(--ink-3)",
          backgroundColor: "var(--bg-sunken)",
          borderBottom: "1px solid var(--rule)",
        }}
      >
        {t("keyboardHint")}
      </p>
      {view === "list" ? (
        <MapListView data={data} />
      ) : (
        <div
          aria-describedby="map-keyboard-hint"
          style={{ display: "contents" }}
        >
          <MapClient initialData={data} focusLocalityId={focusLocalityId ?? null} />
        </div>
      )}
    </main>
  );
}
