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
  // Hide auto-generated "Basin near 16.09°S 49.44°E" placeholders in the pill
  // row — they render as visual noise. Real basin names (e.g. "Nosivolo")
  // pass through.
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

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "16px 24px 48px" }}>
      {fishbaseUrl ? (
        <>
          <link rel="dns-prefetch" href="https://www.fishbase.se" />
          <link rel="preconnect" href="https://www.fishbase.se" crossOrigin="anonymous" />
        </>
      ) : null}

      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 12 }}
      >
        <Link href={backHref} style={breadcrumbLinkStyle}>
          ← All species
        </Link>
        {sp.family ? (
          <>
            <span aria-hidden="true" style={breadcrumbSepStyle}>/</span>
            <span>{sp.family}</span>
          </>
        ) : null}
        {sp.genus ? (
          <>
            <span aria-hidden="true" style={breadcrumbSepStyle}>/</span>
            <span style={{ fontStyle: "italic" }}>{sp.genus}</span>
          </>
        ) : null}
      </nav>

      {/* Hero — clean cream band, no stripe */}
      <header
        style={{
          padding: "28px 28px 24px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--rule)",
          backgroundColor: "var(--bg-raised)",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <div style={{ minWidth: 0, flex: "1 1 420px" }}>
            {/* Status eyebrow (small-caps, status-colored) */}
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: `var(${statusColorVar})`,
              }}
            >
              {statusEyebrow}
            </p>

            <h1
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 36,
                color: "var(--ink)",
                lineHeight: 1.1,
                margin: "6px 0 0",
              }}
            >
              {displayName}
            </h1>

            {undescribed ? (
              <p style={{ marginTop: 8, fontSize: 12 }}>
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
            ) : sp.authority || sp.year_described ? (
              <p style={{ marginTop: 6, fontSize: 13, color: "var(--ink-3)" }}>
                {sp.authority}
                {sp.authority && sp.year_described ? ", " : ""}
                {sp.year_described}
              </p>
            ) : null}

            {primaryCommon ? (
              <p style={{ marginTop: 10, fontSize: 15, color: "var(--ink-2)" }}>
                {primaryCommon.name}{" "}
                <span style={{ color: "var(--ink-3)", fontSize: 12 }}>
                  ({primaryCommon.language})
                </span>
              </p>
            ) : null}

            {/* Pill row */}
            <div
              style={{
                marginTop: 16,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
              }}
            >
              <IucnBadge
                status={sp.iucn_status}
                criteria={acceptedIucn?.criteria}
              />
              {sp.family ? <OutlinePill>{sp.family.toUpperCase()}</OutlinePill> : null}
              {basinLabel ? (
                <OutlinePill>{basinLabel.toUpperCase()} BASIN</OutlinePill>
              ) : null}
              <OutlinePill>{endemicLabel.toUpperCase()}</OutlinePill>
              {caresShort ? (
                <OutlinePill tone="highlight">{caresShort}</OutlinePill>
              ) : null}
              {sp.shoal_priority ? (
                <OutlinePill tone="accent">SHOAL PRIORITY</OutlinePill>
              ) : null}
            </div>
          </div>

          {/* Silhouette + max length, right-aligned */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 8,
              minWidth: 180,
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
      </header>

      {/* Three summary boxes: Distribution · Ex-situ · Husbandry */}
      <section
        aria-label="Profile summary"
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <SummaryBox title="Distribution">
          {sp.has_localities ? (
            <>
              <p style={summaryValueStyle}>On record in Madagascar</p>
              <Link href={`/map?species_id=${sp.id}`} style={summaryLinkStyle}>
                View on Map →
              </Link>
            </>
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
            marginTop: 16,
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

      {/* Description & Ecology */}
      {sp.description || sp.ecology_notes || sp.morphology || sp.habitat_type ? (
        <section aria-labelledby="ecology-heading" style={{ marginTop: 32 }}>
          <h2 id="ecology-heading" style={sectionHeadingStyle}>
            Description &amp; Ecology
          </h2>
          {sp.description ? (
            <p style={paragraphStyle}>{sp.description}</p>
          ) : null}
          {sp.ecology_notes ? (
            <p style={paragraphStyle}>{sp.ecology_notes}</p>
          ) : null}
          {sp.morphology ? (
            <p style={paragraphStyle}>
              <span style={labelInlineStyle}>Morphology: </span>
              {sp.morphology}
            </p>
          ) : null}
          {sp.habitat_type ? (
            <p style={paragraphStyle}>
              <span style={labelInlineStyle}>Habitat: </span>
              {sp.habitat_type}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Distribution (curated map panel) */}
      <ProfileDistribution speciesId={sp.id} hasLocalities={sp.has_localities} />

      {/* Conservation Status */}
      <section aria-labelledby="conservation-heading" style={{ marginTop: 32 }}>
        <h2 id="conservation-heading" style={sectionHeadingStyle}>
          Conservation Status
        </h2>
        {acceptedIucn ? (
          <dl style={{ marginTop: 8, fontSize: 14, color: "var(--ink-2)" }}>
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
          <p style={paragraphStyle}>
            Not yet assessed on the IUCN Red List.
          </p>
        )}
      </section>

      {/* Common Names */}
      {sp.common_names.length > 0 ? (
        <section aria-labelledby="common-names-heading" style={{ marginTop: 32 }}>
          <h2 id="common-names-heading" style={sectionHeadingStyle}>
            Common Names
          </h2>
          <ul style={{ marginTop: 8, padding: 0, listStyle: "none", fontSize: 14 }}>
            {sp.common_names.map((cn) => (
              <li key={`${cn.language}-${cn.name}`} style={{ color: "var(--ink-2)" }}>
                {cn.name}{" "}
                <span style={{ color: "var(--ink-3)" }}>({cn.language})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Ex-situ Population (detail) */}
      <section aria-labelledby="captive-heading" style={{ marginTop: 32 }}>
        <h2 id="captive-heading" style={sectionHeadingStyle}>
          Ex-situ Population
        </h2>
        {exSituEmpty ? (
          <div style={{ marginTop: 12 }}>
            <EmptyState
              variant="inline"
              title="No ex-situ population tracked"
              body="No captive population is currently tracked for this species."
            />
          </div>
        ) : (
          <dl
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 16,
            }}
          >
            <StatCell
              label="Institutions holding"
              value={institutions_holding || "—"}
            />
            <StatCell
              label="Total individuals"
              value={total_individuals || "—"}
            />
            <StatCell
              label="Active breeding programs"
              value={breeding_programs || "—"}
            />
          </dl>
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

      {(() => {
        const fpEmpty = sp.field_programs.length === 0;
        const fieldPrograms = (
          <section aria-labelledby="field-heading" style={{ marginTop: 32 }}>
            <h2 id="field-heading" style={sectionHeadingStyle}>
              Field Programs
            </h2>
            {fpEmpty ? (
              <div style={{ marginTop: 8 }}>
                <EmptyState
                  variant="inline"
                  title="No linked field programs"
                  body="No field programs are currently linked to this species."
                />
              </div>
            ) : (
              <ul style={{ marginTop: 8, padding: 0, listStyle: "none", fontSize: 14 }}>
                {sp.field_programs.map((fp) => (
                  <li key={fp.id} style={{ color: "var(--ink-2)" }}>
                    {fp.name}{" "}
                    <span style={{ color: "var(--ink-3)" }}>({fp.status})</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
        const externalRefs =
          iucnUrl || fishbaseUrl ? (
            <section aria-labelledby="links-heading" style={{ marginTop: 32 }}>
              <h2 id="links-heading" style={sectionHeadingStyle}>
                External References
              </h2>
              <ul style={{ marginTop: 8, padding: 0, listStyle: "none", fontSize: 14 }}>
                {iucnUrl ? (
                  <li>
                    <a
                      href={iucnUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--accent-2)", textDecoration: "underline" }}
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
                      style={{ color: "var(--accent-2)", textDecoration: "underline" }}
                    >
                      FishBase species summary →
                    </a>
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null;
        return fpEmpty ? (
          <>
            {externalRefs}
            {fieldPrograms}
          </>
        ) : (
          <>
            {fieldPrograms}
            {externalRefs}
          </>
        );
      })()}
    </main>
  );
}

const breadcrumbLinkStyle = {
  color: "var(--accent-2)",
  textDecoration: "none",
};

const breadcrumbSepStyle = {
  margin: "0 8px",
  color: "var(--ink-3)",
};

const sectionHeadingStyle = {
  fontFamily: "var(--serif)",
  fontSize: 22,
  color: "var(--ink)",
  margin: 0,
};

const paragraphStyle = {
  marginTop: 8,
  fontSize: 14,
  color: "var(--ink-2)",
  lineHeight: 1.55,
};

const labelInlineStyle = {
  fontWeight: 600,
  color: "var(--ink-3)",
};

const summaryValueStyle = {
  margin: "6px 0 0",
  fontSize: 15,
  fontWeight: 600,
  color: "var(--ink)",
};

const summarySubStyle = {
  margin: "2px 0 0",
  fontSize: 12,
  color: "var(--ink-3)",
};

const summaryMutedStyle = {
  margin: "6px 0 0",
  fontSize: 13,
  color: "var(--ink-3)",
};

const summaryLinkStyle = {
  display: "inline-block",
  marginTop: 6,
  fontSize: 12,
  color: "var(--accent-2)",
  textDecoration: "underline",
};

function OutlinePill({
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
        : "var(--ink-2)";
  const border =
    tone === "highlight"
      ? "color-mix(in oklab, var(--highlight) 40%, var(--rule))"
      : tone === "accent"
        ? "color-mix(in oklab, var(--accent) 40%, var(--rule))"
        : "var(--rule-strong)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        padding: "0 10px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        lineHeight: 1,
        color,
        border: `1px solid ${border}`,
        backgroundColor: "transparent",
        whiteSpace: "nowrap",
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
        padding: "14px 16px",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--rule)",
        backgroundColor: "var(--bg-raised)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-3)",
        }}
      >
        {title}
      </p>
      {children}
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

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt style={{ fontSize: 12, color: "var(--ink-3)" }}>{label}</dt>
      <dd
        style={{
          marginTop: 2,
          fontSize: 22,
          fontWeight: 600,
          color: "var(--ink)",
        }}
      >
        {value}
      </dd>
    </div>
  );
}
