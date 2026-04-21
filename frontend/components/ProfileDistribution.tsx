import dynamic from "next/dynamic";
import Link from "next/link";

import { fetchLocalities } from "@/lib/mapLocalities";
import { fetchSiteMapAsset } from "@/lib/siteMapAssets";

/**
 * ProfileDistribution — S20 profile Distribution section.
 *
 * Renders the curated `profile_panel` SiteMapAsset thumbnail (or a stripe
 * fallback when no asset is uploaded) above an embedded, constrained-height
 * interactive MapClient filtered to the current species.
 *
 * Server component: fetches the SMA + localities in parallel, then hands
 * the features to a client-only MapClient via next/dynamic.
 */

const MapClient = dynamic(() => import("./MapClient"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-[380px] w-full items-center justify-center bg-stripe-fallback text-sm"
      style={{ color: "var(--ink-3)" }}
      role="status"
    >
      Loading map…
    </div>
  ),
});

export default async function ProfileDistribution({
  speciesId,
  hasLocalities,
}: {
  speciesId: number;
  hasLocalities: boolean;
}) {
  const [sma, localities] = await Promise.all([
    fetchSiteMapAsset("profile_panel"),
    hasLocalities
      ? fetchLocalities({ species_id: String(speciesId) })
      : Promise.resolve(null),
  ]);

  return (
    <section aria-labelledby="distribution-heading" style={{ marginTop: 32 }}>
      <h2
        id="distribution-heading"
        style={{
          fontFamily: "var(--serif)",
          fontSize: 22,
          color: "var(--ink)",
          margin: "0 0 12px",
        }}
      >
        Distribution
      </h2>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--rule)",
          overflow: "hidden",
          backgroundColor: "var(--bg-raised)",
        }}
      >
        {sma ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sma.url}
            alt={sma.alt || "Distribution overview"}
            width={sma.width}
            height={sma.height}
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              maxHeight: 220,
              objectFit: "cover",
              borderBottom: "1px solid var(--rule)",
            }}
          />
        ) : (
          <div
            aria-hidden="true"
            className="bg-stripe-fallback"
            style={{
              height: 120,
              borderBottom: "1px solid var(--rule)",
            }}
          />
        )}

        {hasLocalities && localities && localities.features.length > 0 ? (
          <>
            <div style={{ padding: "0 16px" }}>
              <p style={{ fontSize: 13, color: "var(--ink-2)", margin: 0 }}>
                {localities.features.length} locality record
                {localities.features.length === 1 ? "" : "s"} on record.{" "}
                <Link
                  href={`/map?species_id=${speciesId}`}
                  style={{ color: "var(--accent-2)", textDecoration: "underline" }}
                >
                  Open full map →
                </Link>
              </p>
            </div>
            <MapClient initialData={localities} heightClass="h-[380px]" />
          </>
        ) : (
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0 }}>
              No locality records are currently mapped for this species.
            </p>
          </div>
        )}

        {sma?.credit ? (
          <p
            style={{
              fontSize: 11,
              color: "var(--ink-3)",
              padding: "0 16px 12px",
              margin: 0,
            }}
          >
            Map panel: {sma.credit}
          </p>
        ) : null}
      </div>
    </section>
  );
}
