import Link from "next/link";
import { notFound } from "next/navigation";

import EmptyState from "@/components/EmptyState";
import HusbandryTeaser from "@/components/HusbandryTeaser";
import IucnBadge from "@/components/IucnBadge";
import ProfileDistribution from "@/components/ProfileDistribution";
import SpeciesSilhouette from "@/components/SpeciesSilhouette";
import { fetchGenusSilhouette } from "@/lib/genusSilhouette";
import { IUCN_LABELS, type IucnStatus } from "@/lib/species";
import {
  displayScientificName,
  fetchSpeciesDetail,
  fishbaseGenusSpeciesUrl,
  iucnRedListUrl,
  type SpeciesDetail,
} from "@/lib/speciesDetail";

export const revalidate = 3600;

type SearchParams = Record<string, string | string[] | undefined>;

function backLinkHref(from: string | string[] | undefined): string {
  const raw = Array.isArray(from) ? from[0] : from;
  if (!raw) return "/species";
  if (raw.startsWith("/species")) return raw;
  if (raw.startsWith("?")) return `/species${raw}`;
  return "/species";
}

function countPopulatedFields(sp: SpeciesDetail): number {
  const candidates: Array<unknown> = [
    sp.description,
    sp.ecology_notes,
    sp.distribution_narrative,
    sp.morphology,
    sp.habitat_type,
    sp.authority,
    sp.max_length_cm,
    sp.common_names.length > 0 ? "y" : "",
  ];
  return candidates.filter((v) => v != null && v !== "" && v !== 0).length;
}

// Hero tint gradient (left→right, fading ~8% IUCN color into page bg).
// Matches the Claude Design prototype: `${c.bg}14 0%, transparent 60%`.
const STATUS_COLOR_VAR: Record<IucnStatus, string> = {
  CR: "--iucn-cr",
  EN: "--iucn-en",
  VU: "--iucn-vu",
  NT: "--iucn-nt",
  LC: "--iucn-lc",
  DD: "--iucn-dd",
  NE: "--iucn-ne",
};

function statusEyebrowLabel(status: IucnStatus | null): string {
  if (!status) return "NOT YET ASSESSED";
  return IUCN_LABELS[status].toUpperCase();
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}) {
  const result = await fetchSpeciesDetail(params.id);
  if (result.kind !== "ok") {
    return { title: "Species not found — Madagascar Freshwater Fish" };
  }
  const name = displayScientificName(result.data);
  return {
    title: `${name} — Madagascar Freshwater Fish`,
    description: result.data.description?.slice(0, 160) ?? `Species profile for ${name}.`,
  };
}

export default async function SpeciesProfilePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: SearchParams;
}) {
  const result = await fetchSpeciesDetail(params.id);
  if (result.kind === "not_found") notFound();
  if (result.kind === "error") {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "96px 24px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: 24, color: "var(--ink)" }}>
          Species profile temporarily unavailable
        </h1>
        <p style={{ marginTop: 16, color: "var(--ink-2)" }}>
          The species data service is unreachable. Try again in a moment, or
          return to the directory.
        </p>
        <Link
          href="/species"
          style={{
            display: "inline-block",
            marginTop: 24,
            padding: "8px 16px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--rule-strong)",
            color: "var(--ink-2)",
            fontSize: 13,
          }}
        >
          ← All species
        </Link>
      </main>
    );
  }
  const sp = result.data;
  const displayName = displayScientificName(sp);
  const backHref = backLinkHref(searchParams.from);
  const undescribed = sp.taxonomic_status === "undescribed_morphospecies";
  const sparse = countPopulatedFields(sp) < 3;

  const needsGenusCascade =
    !sp.silhouette_svg && sp.genus_fk?.has_silhouette === true;
  const genusSilhouette = needsGenusCascade
    ? await fetchGenusSilhouette(sp.genus_fk!.name)
    : null;
  const effectiveSvg = sp.silhouette_svg || genusSilhouette?.svg || "";
  const silhouetteCredit = sp.silhouette_svg
    ? null
    : genusSilhouette?.credit || null;

  const acceptedIucn = sp.conservation_assessments.find(
    (a) => a.source === "iucn_official" || a.source === "manual_expert",
  );
  const iucnUrl = iucnRedListUrl(sp.iucn_taxon_id);
  const fishbaseUrl = fishbaseGenusSpeciesUrl(sp);

  const endemicLabel =
    sp.endemic_status.charAt(0).toUpperCase() + sp.endemic_status.slice(1);
  const primaryCommon = sp.common_names[0];
  const basinLabel =
    sp.primary_basin && !/^Basin near/i.test(sp.primary_basin)
      ? sp.primary_basin
      : null;
  const statusColorVar = STATUS_COLOR_VAR[sp.iucn_status ?? "NE"];
  const statusEyebrow = statusEyebrowLabel(sp.iucn_status);
  const caresShort = sp.cares_status ? `CARES ${sp.cares_status}` : null;

  const { institutions_holding, total_individuals, breeding_programs } =
    sp.ex_situ_summary;
  const exSituEmpty =
    institutions_holding === 0 && total_individuals === 0 && breeding_programs === 0;

  const habitatLabel = sp.habitat_type || "—";
  const statusDescriptor = undescribed ? "Undescribed morphospecies" : "Described";
  // Summary-box Distribution line reflects how the species relates to
  // Madagascar rather than a generic "on record" phrase. Endemic = only
  // found here; native = occurs here naturally but not restricted;
  // introduced = non-native (rare on the public directory by default).
  const distributionSummary =
    sp.endemic_status === "endemic"
      ? "Endemic to Madagascar"
      : sp.endemic_status === "introduced"
        ? "Introduced to Madagascar"
        : "Native to Madagascar";

  return (
    <main>
      {fishbaseUrl ? (
        <>
          <link rel="dns-prefetch" href="https://www.fishbase.se" />
          <link rel="preconnect" href="https://www.fishbase.se" crossOrigin="anonymous" />
        </>
      ) : null}

      {/* Full-bleed hero with IUCN-tinted gradient */}
      <section
        style={{
          background: "var(--bg-sunken)",
          borderBottom: "1px solid var(--rule)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Color wash — IUCN status color at ~8% alpha fading left→right */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(90deg, color-mix(in oklab, var(${statusColorVar}) 14%, transparent) 0%, transparent 60%)`,
            pointerEvents: "none",
          }}
        />
        <div style={{ ...containerStyle, padding: "24px 28px 40px", position: "relative" }}>
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--ink-3)",
            }}
          >
            <Link href={backHref} style={breadcrumbBackStyle}>
              ← All species
            </Link>
            {sp.family ? (
              <>
                <span aria-hidden="true">/</span>
                <span>{sp.family}</span>
              </>
            ) : null}
            {sp.genus ? (
              <>
                <span aria-hidden="true">/</span>
                <span style={{ color: "var(--ink-2)" }}>{sp.genus}</span>
              </>
            ) : null}
          </nav>

          {/* Two-column hero: details left, silhouette right */}
          <div
            style={{
              marginTop: 24,
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              gap: 32,
              alignItems: "flex-end",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  ...eyebrowStyle,
                  color: `var(${statusColorVar})`,
                  margin: 0,
                }}
              >
                {statusEyebrow}
              </p>

              <h1
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: "clamp(36px, 6vw, 56px)",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  color: "var(--ink)",
                  lineHeight: 1.05,
                  margin: "8px 0 0",
                }}
              >
                {displayName}
              </h1>

              {sp.authority || sp.year_described ? (
                <p
                  style={{
                    marginTop: 6,
                    fontFamily: "var(--serif)",
                    fontSize: 15,
                    color: "var(--ink-2)",
                  }}
                >
                  {sp.authority}
                  {sp.authority && sp.year_described ? ", " : ""}
                  {sp.year_described}
                </p>
              ) : null}

              {undescribed ? (
                <p style={{ marginTop: 12, fontSize: 12 }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 999,
                      backgroundColor: "var(--accent-soft)",
                      color: "var(--accent-2)",
                      fontWeight: 600,
                      fontSize: 11,
                      marginRight: 8,
                    }}
                  >
                    Provisional Name
                  </span>
                  <span style={{ color: "var(--ink-2)" }}>
                    Undescribed morphospecies — formal description pending.
                  </span>
                </p>
              ) : null}

              {primaryCommon ? (
                <p
                  style={{
                    marginTop: 14,
                    fontFamily: "var(--serif)",
                    fontSize: 22,
                    color: "var(--ink-2)",
                  }}
                >
                  {primaryCommon.name}{" "}
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 13,
                      color: "var(--ink-3)",
                      marginLeft: 6,
                    }}
                  >
                    ({primaryCommon.language})
                  </span>
                </p>
              ) : null}

              <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <IucnBadge
                  status={sp.iucn_status}
                  showLabel
                  criteria={acceptedIucn?.criteria}
                />
                {sp.family ? <BasinPill>{sp.family}</BasinPill> : null}
                {basinLabel ? <BasinPill>{basinLabel} basin</BasinPill> : null}
                <BasinPill>{endemicLabel}</BasinPill>
                {caresShort ? (
                  <BasinPill tone="highlight">{caresShort}</BasinPill>
                ) : null}
                {sp.shoal_priority ? (
                  <BasinPill tone="accent">SHOAL priority</BasinPill>
                ) : null}
              </div>
            </div>

            {/* Silhouette column */}
            <div
              style={{
                width: 260,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
              }}
            >
              <SpeciesSilhouette
                maxLengthCm={sp.max_length_cm}
                scientificName={displayName}
                customSvg={effectiveSvg}
                svgCredit={silhouetteCredit}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Page body — constrained container */}
      <div style={{ ...containerStyle, padding: "32px 28px 48px" }}>
        {/* Three summary boxes: Distribution · Ex-situ · Husbandry */}
        <section
          aria-label="Profile summary"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          <SummaryBox title="Distribution">
            <p style={summaryValueStyle}>{distributionSummary}</p>
            {sp.has_localities ? (
              <Link href={`/map?species_id=${sp.id}`} style={summaryLinkStyle}>
                View on Map →
              </Link>
            ) : (
              <p style={summaryMutedStyle}>No locality records mapped.</p>
            )}
          </SummaryBox>

          <SummaryBox title="Ex-situ Coverage">
            {exSituEmpty ? (
              <p style={summaryMutedStyle}>No captive population tracked.</p>
            ) : (
              <>
                <p style={summaryValueStyle}>
                  {institutions_holding} institution
                  {institutions_holding === 1 ? "" : "s"}
                </p>
                <p style={summarySubStyle}>
                  {total_individuals || "—"} individuals ·{" "}
                  {breeding_programs || 0} breeding
                </p>
              </>
            )}
          </SummaryBox>

          <SummaryBox title="Husbandry">
            {sp.has_husbandry ? (
              <>
                <p style={summaryValueStyle}>
                  {sp.difficulty_factor_count} difficulty factor
                  {sp.difficulty_factor_count === 1 ? "" : "s"}
                </p>
                <Link
                  href={`/species/${sp.id}/husbandry/`}
                  style={summaryLinkStyle}
                >
                  See guidance →
                </Link>
              </>
            ) : (
              <p style={summaryMutedStyle}>No husbandry guidance yet.</p>
            )}
          </SummaryBox>
        </section>

        {sparse ? (
          <p
            style={{
              marginTop: 24,
              padding: "8px 14px",
              fontSize: 13,
              color: "var(--highlight)",
              backgroundColor: "color-mix(in oklab, var(--highlight) 10%, var(--bg-raised))",
              border: "1px solid color-mix(in oklab, var(--highlight) 40%, var(--rule))",
              borderRadius: "var(--radius-md)",
            }}
          >
            Limited public data is available for this species. Additional
            information will be added as it is published.
          </p>
        ) : null}

        {/* Description & Ecology — eyebrow, lead serif paragraph, 4-col meta */}
        {sp.description ||
        sp.ecology_notes ||
        sp.morphology ||
        sp.habitat_type ||
        sp.max_length_cm ||
        basinLabel ? (
          <section id="description" style={{ marginTop: 48 }}>
            <p style={eyebrowStyle}>Description &amp; Ecology</p>
            {sp.description ? (
              <p
                style={{
                  marginTop: 12,
                  fontFamily: "var(--serif)",
                  fontSize: 19,
                  lineHeight: 1.55,
                  color: "var(--ink)",
                  maxWidth: 640,
                }}
              >
                {sp.description}
              </p>
            ) : null}
            {sp.ecology_notes ? (
              <p style={{ ...paragraphStyle, maxWidth: 640 }}>{sp.ecology_notes}</p>
            ) : null}
            {sp.morphology ? (
              <p style={{ ...paragraphStyle, maxWidth: 640 }}>
                <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
                  Morphology.
                </strong>{" "}
                {sp.morphology}
              </p>
            ) : null}

            <dl
              style={{
                marginTop: 24,
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 20,
              }}
            >
              <DtDd
                label="Max length"
                value={sp.max_length_cm ? `${sp.max_length_cm} cm` : "—"}
              />
              <DtDd label="Habitat" value={habitatLabel} />
              <DtDd label="Basin" value={basinLabel || "—"} />
              <DtDd label="Status" value={statusDescriptor} />
            </dl>
          </section>
        ) : null}

        {/* Distribution (curated map panel) */}
        <ProfileDistribution speciesId={sp.id} hasLocalities={sp.has_localities} />

        {/* Conservation Status · Common Names — paired two-column section */}
        <section
          aria-label="Conservation status and common names"
          style={{
            marginTop: 48,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 40,
          }}
        >
          <div id="conservation">
            <p style={eyebrowStyle}>Red List Status</p>
            <h2 style={h2Style}>Conservation Status</h2>
            {acceptedIucn ? (
              <dl style={{ marginTop: 12, fontSize: 14, color: "var(--ink-2)" }}>
                <DlRow label="Category" value={acceptedIucn.category} />
                {acceptedIucn.criteria ? (
                  <DlRow label="Criteria" value={acceptedIucn.criteria} />
                ) : null}
                {acceptedIucn.assessor ? (
                  <DlRow label="Assessor" value={acceptedIucn.assessor} />
                ) : null}
                {acceptedIucn.assessment_date ? (
                  <DlRow label="Date" value={acceptedIucn.assessment_date} />
                ) : null}
              </dl>
            ) : (
              <p style={{ ...paragraphStyle, maxWidth: 640 }}>
                Not yet assessed on the IUCN Red List.
              </p>
            )}
            {caresShort ? (
              <p style={{ marginTop: 10, fontSize: 14, color: "var(--ink-2)" }}>
                <span style={{ color: "var(--ink-3)", fontWeight: 600 }}>
                  CARES:{" "}
                </span>
                {sp.cares_status}
              </p>
            ) : null}
            {sp.shoal_priority ? (
              <p style={{ marginTop: 4, fontSize: 14, color: "var(--ink-2)" }}>
                SHOAL 1,000 Fishes priority species.
              </p>
            ) : null}
          </div>

          <div id="common-names">
            <p style={eyebrowStyle}>Vernacular</p>
            <h2 style={h2Style}>Common Names</h2>
            {sp.common_names.length > 0 ? (
              <ul
                style={{
                  marginTop: 12,
                  padding: 0,
                  listStyle: "none",
                  fontSize: 14,
                }}
              >
                {sp.common_names.map((cn) => (
                  <li
                    key={`${cn.language}-${cn.name}`}
                    style={{ color: "var(--ink-2)", padding: "2px 0" }}
                  >
                    {cn.name}{" "}
                    <span style={{ color: "var(--ink-3)" }}>({cn.language})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ ...paragraphStyle, maxWidth: 640 }}>
                No common names recorded.
              </p>
            )}
          </div>
        </section>

        {/* Captive population summary — ex-situ stewardship */}
        <section id="captive" style={{ marginTop: 48 }}>
          <p style={eyebrowStyle}>Ex-situ Stewardship</p>
          <h2 style={h2Style}>Captive population summary</h2>
          {exSituEmpty ? (
            <div
              className="card"
              style={{
                marginTop: 16,
                padding: 20,
                borderLeft: `3px solid var(--iucn-cr)`,
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--rule)",
                borderLeftWidth: 3,
                borderLeftColor: "var(--iucn-cr)",
                backgroundColor: "var(--bg-raised)",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--serif)",
                  fontSize: 18,
                  color: "var(--ink)",
                }}
              >
                No captive population is currently tracked.
              </p>
              <p
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  color: "var(--ink-2)",
                  maxWidth: 560,
                }}
              >
                {sp.iucn_status && ["CR", "EN", "VU"].includes(sp.iucn_status)
                  ? "This species is threatened and has no ex-situ safety net. Contact the registry to register a holding."
                  : "No institution has registered holdings for this species."}
              </p>
            </div>
          ) : (
            <div
              style={{
                marginTop: 16,
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 16,
              }}
            >
              <StatTile label="Institutions" value={institutions_holding} />
              <StatTile
                label="Individuals"
                value={total_individuals.toLocaleString()}
              />
              <StatTile
                label="Active breeding programs"
                value={breeding_programs}
              />
            </div>
          )}
        </section>

        {sp.has_husbandry ? (
          <HusbandryTeaser
            speciesId={sp.id}
            ctx={{
              has_husbandry: sp.has_husbandry,
              cares_status: sp.cares_status,
              shoal_priority: sp.shoal_priority,
            }}
          />
        ) : null}

        {/* Field Programs — sits under Captive population */}
        <section aria-labelledby="field-heading" style={{ marginTop: 48 }}>
          <p id="field-heading" style={eyebrowStyle}>
            Field Programs
          </p>
          <h2 style={h2Style}>In-situ linkages</h2>
          {sp.field_programs.length === 0 ? (
            <div style={{ marginTop: 16 }}>
              <EmptyState
                variant="inline"
                title="No linked field programs"
                body="No field programs are currently linked to this species."
              />
            </div>
          ) : (
            <ul
              style={{
                marginTop: 16,
                padding: 0,
                listStyle: "none",
                fontSize: 14,
              }}
            >
              {sp.field_programs.map((fp) => (
                <li
                  key={fp.id}
                  style={{ color: "var(--ink-2)", padding: "2px 0" }}
                >
                  {fp.name}{" "}
                  <span style={{ color: "var(--ink-3)" }}>({fp.status})</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {iucnUrl || fishbaseUrl ? (
          <section id="refs" style={{ marginTop: 48 }}>
            <p style={eyebrowStyle}>External References</p>
            <ul
              style={{
                marginTop: 12,
                padding: 0,
                listStyle: "none",
                fontSize: 14,
                display: "grid",
                gap: 6,
              }}
            >
              {iucnUrl ? (
                <li>
                  <a
                    href={iucnUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={refLinkStyle}
                  >
                    IUCN Red List assessment →
                  </a>
                </li>
              ) : null}
              {fishbaseUrl ? (
                <li>
                  <a
                    href={fishbaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={refLinkStyle}
                  >
                    FishBase species summary →
                  </a>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}

const containerStyle = {
  maxWidth: 1280,
  marginLeft: "auto",
  marginRight: "auto",
} as const;

const breadcrumbBackStyle = {
  color: "var(--ink-2)",
  textDecoration: "none",
  padding: "4px 8px",
  marginLeft: -8,
  borderRadius: "var(--radius-md)",
};

const eyebrowStyle = {
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase" as const,
  color: "var(--ink-3)",
  margin: 0,
};

const h2Style = {
  marginTop: 8,
  fontFamily: "var(--serif)",
  fontSize: 28,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: "var(--ink)",
  lineHeight: 1.15,
  marginBottom: 0,
};

const refLinkStyle = {
  color: "var(--accent-2)",
  textDecoration: "none",
  borderBottom:
    "1px solid color-mix(in oklab, var(--accent-2) 35%, transparent)",
};

const paragraphStyle = {
  marginTop: 12,
  fontSize: 14,
  color: "var(--ink-2)",
  lineHeight: 1.55,
};

const summaryValueStyle = {
  margin: "8px 0 0",
  fontFamily: "var(--serif)",
  fontSize: 22,
  fontWeight: 600,
  color: "var(--ink)",
  lineHeight: 1.15,
};

const summarySubStyle = {
  margin: "4px 0 0",
  fontSize: 13,
  color: "var(--ink-2)",
};

const summaryMutedStyle = {
  margin: "8px 0 0",
  fontSize: 13,
  color: "var(--ink-3)",
};

const summaryLinkStyle = {
  display: "inline-block",
  marginTop: 8,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--accent-2)",
  textDecoration: "none",
  borderBottom: "1px solid color-mix(in oklab, var(--accent-2) 35%, transparent)",
};

function BasinPill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "highlight" | "accent";
}) {
  const color =
    tone === "highlight"
      ? "var(--highlight)"
      : tone === "accent"
        ? "var(--accent)"
        : "var(--ink-3)";
  const border =
    tone === "highlight"
      ? "color-mix(in oklab, var(--highlight) 40%, var(--rule))"
      : tone === "accent"
        ? "color-mix(in oklab, var(--accent) 40%, var(--rule))"
        : "var(--rule)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color,
        padding: "3px 10px",
        border: `1px solid ${border}`,
        borderRadius: 999,
        backgroundColor: "var(--bg)",
        whiteSpace: "nowrap",
        lineHeight: 1.2,
      }}
    >
      {children}
    </span>
  );
}

function SummaryBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--rule)",
        backgroundColor: "var(--bg-raised)",
      }}
    >
      <p style={eyebrowStyle}>{title}</p>
      {children}
    </div>
  );
}

function DtDd({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ ...eyebrowStyle, fontSize: 10 }}>{label}</dt>
      <dd style={{ marginTop: 6, margin: "6px 0 0", fontSize: 14, color: "var(--ink)" }}>
        {value}
      </dd>
    </div>
  );
}

function DlRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginTop: 4 }}>
      <dt style={{ display: "inline", fontWeight: 600, color: "var(--ink-3)" }}>
        {label}:{" "}
      </dt>
      <dd style={{ display: "inline", margin: 0 }}>{value}</dd>
    </div>
  );
}

function StatTile({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        padding: 20,
        border: "1px solid var(--rule)",
        borderRadius: "var(--radius-lg)",
        backgroundColor: "var(--bg-raised)",
      }}
    >
      <p style={eyebrowStyle}>{label}</p>
      <p
        style={{
          margin: "8px 0 0",
          fontFamily: "var(--serif)",
          fontSize: 28,
          fontWeight: 500,
          fontVariantNumeric: "tabular-nums",
          color: "var(--ink)",
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
    </div>
  );
}
