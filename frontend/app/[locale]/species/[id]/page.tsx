import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import EmptyState from "@/components/EmptyState";
import IucnBadge from "@/components/IucnBadge";
import ProfileCommonNames from "@/components/ProfileCommonNames";
import ProfileDistribution from "@/components/ProfileDistribution";
import SpeciesSilhouette from "@/components/SpeciesSilhouette";
import type { Locale } from "@/i18n/routing";
import { fetchGenusSilhouette } from "@/lib/genusSilhouette";
import { buildAlternates } from "@/lib/seo";
import { type IucnStatus } from "@/lib/species";
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

export async function generateMetadata({
  params,
}: {
  params: { id: string; locale: Locale };
}) {
  const result = await fetchSpeciesDetail(params.id, { locale: params.locale });
  const t = await getTranslations({
    locale: params.locale,
    namespace: "species.profile",
  });
  if (result.kind !== "ok") {
    return {
      title: t("metaTitleNotFound"),
      alternates: buildAlternates(`/species/${params.id}`, params.locale),
    };
  }
  const name = displayScientificName(result.data);
  return {
    title: t("metaTitleTemplate", { name }),
    description:
      result.data.description?.slice(0, 160) ??
      t("metaDescriptionFallback", { name }),
    alternates: buildAlternates(`/species/${params.id}`, params.locale),
  };
}

export default async function SpeciesProfilePage({
  params,
  searchParams,
}: {
  params: { id: string; locale: Locale };
  searchParams: SearchParams;
}) {
  const result = await fetchSpeciesDetail(params.id, { locale: params.locale });
  const [t, tCommon] = await Promise.all([
    getTranslations("species.profile"),
    getTranslations("common"),
  ]);

  if (result.kind === "not_found") notFound();
  if (result.kind === "error") {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "96px 24px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: 24, color: "var(--ink)" }}>
          {t("errorState.title")}
        </h1>
        <p style={{ marginTop: 16, color: "var(--ink-2)" }}>
          {t("errorState.body")}
        </p>
        <Link
          href="/species"
          style={{
            display: "inline-block",
            marginTop: 24,
            padding: "8px 16px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--rule-strong)",
            color: "var(--ink-2)",
            fontSize: 13,
          }}
        >
          {t("errorState.backToDirectory")}
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
  // Fallback: when no assessment row is synced yet, the mirrored status on
  // Species is still the source of truth (per the mirror policy). Render
  // a minimal row so the Conservation Status panel matches the hero badge.
  const displayIucn =
    acceptedIucn ??
    (sp.iucn_status
      ? {
          category: sp.iucn_status,
          source: "mirror",
          assessment_date: null,
          assessor: "",
          criteria: "",
        }
      : null);
  const iucnUrl = iucnRedListUrl(sp.iucn_taxon_id);
  const fishbaseUrl = fishbaseGenusSpeciesUrl(sp);

  // endemic_status enum values from the API: endemic, native, introduced.
  // We surface only "endemic" specifically capitalized; other values get
  // capitalized as-is (rare on the public directory).
  const endemicLabel =
    sp.endemic_status.charAt(0).toUpperCase() + sp.endemic_status.slice(1);
  const primaryCommon = sp.common_names[0];
  const basinLabel =
    sp.primary_basin && !/^Basin near/i.test(sp.primary_basin)
      ? sp.primary_basin
      : null;
  const statusColorVar = STATUS_COLOR_VAR[sp.iucn_status ?? "NE"];
  const statusEyebrow = sp.iucn_status
    ? tCommon(`iucn.${sp.iucn_status}`).toUpperCase()
    : tCommon("iucn.NE").toUpperCase();
  const caresShort = sp.cares_status
    ? t("pills.caresPrefix", { status: sp.cares_status })
    : null;

  const { institutions_holding, total_individuals, breeding_programs } =
    sp.ex_situ_summary;
  const exSituEmpty =
    institutions_holding === 0 && total_individuals === 0 && breeding_programs === 0;

  const habitatLabel = sp.habitat_type || t("stats.emDash");
  const statusDescriptor = undescribed
    ? t("stats.statusUndescribed")
    : t("stats.statusDescribed");
  // Summary-box Distribution line reflects how the species relates to
  // Madagascar rather than a generic "on record" phrase.
  const distributionSummary =
    sp.endemic_status === "endemic"
      ? t("summary.endemicToMadagascar")
      : sp.endemic_status === "introduced"
        ? t("summary.introducedToMadagascar")
        : t("summary.nativeToMadagascar");

  // Keeping-this-species note: 4 variants depending on CARES + SHOAL priority.
  let keepingNote: string;
  if (caresShort && sp.shoal_priority) {
    keepingNote = t("keeping.noteCaresAndShoal");
  } else if (caresShort) {
    keepingNote = t("keeping.noteCares");
  } else if (sp.shoal_priority) {
    keepingNote = t("keeping.noteShoal");
  } else {
    keepingNote = t("keeping.noteGeneric");
  }

  // Captive-population empty body: threatened (CR/EN/VU) gets a
  // call-to-action prompting institutional outreach; non-threatened
  // species get a neutral note.
  const captiveEmptyBody =
    sp.iucn_status && ["CR", "EN", "VU"].includes(sp.iucn_status)
      ? t("captive.noneTrackedThreatened")
      : t("captive.noneTrackedNonThreatened");

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
            aria-label={t("breadcrumb.ariaLabel")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--ink-3)",
            }}
          >
            <Link href={backHref} style={breadcrumbBackStyle}>
              {t("breadcrumb.back")}
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
                    {t("provisionalPill")}
                  </span>
                  <span style={{ color: "var(--ink-2)" }}>
                    {t("provisionalNote")}
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
                    {t("primaryCommonLanguage", { language: primaryCommon.language })}
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
                {basinLabel ? (
                  <BasinPill>{t("pills.basinSuffix", { basin: basinLabel })}</BasinPill>
                ) : null}
                <BasinPill>{endemicLabel}</BasinPill>
                {caresShort ? (
                  <BasinPill tone="highlight">{caresShort}</BasinPill>
                ) : null}
                {sp.shoal_priority ? (
                  <BasinPill tone="accent">{t("pills.shoalPriority")}</BasinPill>
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
          aria-label={t("summaryAriaLabel")}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          <SummaryBox title={t("summary.distributionTitle")}>
            <p style={summaryValueStyle}>{distributionSummary}</p>
            {sp.has_localities ? (
              <>
                <p style={summarySubStyle}>
                  {t("summary.mappedAt", { count: sp.locality_count })}
                </p>
                <Link href={`/map?species_id=${sp.id}`} style={summaryLinkStyle}>
                  {t("summary.viewOnMap")}
                </Link>
              </>
            ) : (
              <p style={summaryMutedStyle}>{t("summary.noLocalitiesMapped")}</p>
            )}
          </SummaryBox>

          <SummaryBox title={t("summary.exSituTitle")}>
            {exSituEmpty ? (
              <p style={summaryMutedStyle}>{t("summary.noCaptiveTracked")}</p>
            ) : (
              <>
                <p style={summaryValueStyle}>
                  {t("summary.institutionsCount", { count: institutions_holding })}
                </p>
                <p style={summarySubStyle}>
                  {total_individuals
                    ? t("summary.exSituSubline", {
                        individuals: total_individuals,
                        programs: breeding_programs || 0,
                      })
                    : t("summary.exSituSublineEmDash", {
                        programs: breeding_programs || 0,
                      })}
                </p>
              </>
            )}
          </SummaryBox>

          <SummaryBox title={t("summary.husbandryTitle")}>
            {sp.has_husbandry ? (
              <>
                <p style={summaryValueStyle}>
                  {t("summary.husbandryDifficulty", {
                    count: sp.difficulty_factor_count,
                  })}
                </p>
                <Link
                  href={`/species/${sp.id}/husbandry/`}
                  style={summaryLinkStyle}
                >
                  {t("summary.seeGuidance")}
                </Link>
              </>
            ) : (
              <p style={summaryMutedStyle}>{t("summary.noHusbandryYet")}</p>
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
              borderRadius: "var(--radius)",
            }}
          >
            {t("sparseDataNote")}
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
            <p style={eyebrowStyle}>{t("descriptionEcology.eyebrow")}</p>
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
                  {t("descriptionEcology.morphologyInline")}
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
                label={t("stats.maxLength")}
                value={
                  sp.max_length_cm
                    ? t("stats.maxLengthValue", { cm: sp.max_length_cm })
                    : t("stats.emDash")
                }
              />
              <DtDd label={t("stats.habitat")} value={habitatLabel} />
              <DtDd label={t("stats.basin")} value={basinLabel || t("stats.emDash")} />
              <DtDd label={t("stats.status")} value={statusDescriptor} />
            </dl>
          </section>
        ) : null}

        {/* Distribution + Common Names — paired two-column */}
        <section
          aria-label={t("distributionAndCommonNamesAriaLabel")}
          style={{
            marginTop: 48,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 40,
            alignItems: "start",
          }}
        >
          <ProfileDistribution
            speciesId={sp.id}
            hasLocalities={sp.has_localities}
            narrative={sp.distribution_narrative ?? ""}
          />
          <ProfileCommonNames commonNames={sp.common_names} />
        </section>

        {/* Keeping this species · Conservation Status — paired two-column */}
        <section
          aria-label={t("husbandryAndStatusAriaLabel")}
          style={{
            marginTop: 48,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 40,
            alignItems: "stretch",
          }}
        >
          {sp.has_husbandry ? (
            <div
              id="keeping"
              aria-labelledby="husbandry-teaser-heading"
              style={{
                padding: "20px 22px",
                border: "1px solid var(--rule)",
                borderLeft: "3px solid var(--iucn-nt)",
                borderRadius: "var(--radius-lg)",
                backgroundColor: "var(--bg-raised)",
              }}
            >
              <p style={eyebrowStyle}>{t("keeping.eyebrow")}</p>
              <h2 id="husbandry-teaser-heading" style={h2Style}>
                {t("keeping.title")}
              </h2>
              {caresShort || sp.shoal_priority ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 12,
                  }}
                >
                  {caresShort ? (
                    <BasinPill tone="highlight">{caresShort}</BasinPill>
                  ) : null}
                  {sp.shoal_priority ? (
                    <BasinPill tone="accent">{t("keeping.shoalPriorityPill")}</BasinPill>
                  ) : null}
                </div>
              ) : null}
              <p style={{ ...paragraphStyle, maxWidth: 560 }}>{keepingNote}</p>
              <p style={{ marginTop: 10, fontSize: 14 }}>
                <Link
                  href={`/species/${sp.id}/husbandry/`}
                  style={refLinkStyle}
                >
                  {t("keeping.seeGuidance")}
                </Link>
              </p>
            </div>
          ) : null}

          <ConservationStatusPanel
            status={sp.iucn_status}
            assessment={displayIucn}
            iucnUrl={iucnUrl}
          />
        </section>

        {/* Captive population summary — ex-situ stewardship */}
        <section id="captive" style={{ marginTop: 48 }}>
          <p style={eyebrowStyle}>{t("captive.eyebrow")}</p>
          <h2 style={h2Style}>{t("captive.title")}</h2>
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
                {t("captive.noneTracked")}
              </p>
              <p
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  color: "var(--ink-2)",
                  lineHeight: 1.55,
                }}
              >
                {captiveEmptyBody}
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
              <StatTile label={t("captive.institutionsLabel")} value={institutions_holding} />
              <StatTile
                label={t("captive.individualsLabel")}
                value={total_individuals.toLocaleString()}
              />
              <StatTile
                label={t("captive.breedingProgramsLabel")}
                value={breeding_programs}
              />
            </div>
          )}
        </section>

        {/* Field Programs — sits under Captive population */}
        <section aria-labelledby="field-heading" style={{ marginTop: 48 }}>
          <p id="field-heading" style={eyebrowStyle}>
            {t("field.eyebrow")}
          </p>
          <h2 style={h2Style}>{t("field.title")}</h2>
          {sp.field_programs.length === 0 ? (
            <div style={{ marginTop: 16 }}>
              <EmptyState
                variant="inline"
                title={t("field.emptyTitle")}
                body={t("field.emptyBody")}
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
            <p style={eyebrowStyle}>{t("external.eyebrow")}</p>
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
                    {t("external.iucnLink")}
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
                    {t("external.fishbaseLink")}
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
  borderRadius: "var(--radius)",
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

async function ConservationStatusPanel({
  status,
  assessment,
  iucnUrl,
}: {
  status: IucnStatus | null;
  assessment: {
    category: string;
    source: string;
    assessment_date: string | null;
    assessor: string;
    criteria: string;
  } | null;
  iucnUrl: string | null;
}) {
  const key: IucnStatus = status ?? "NE";
  const colorVar = STATUS_COLOR_VAR[key];
  const [t, tCommon] = await Promise.all([
    getTranslations("species.profile"),
    getTranslations("common"),
  ]);
  const label = tCommon(`iucn.${key}`);
  const description = t(`iucnDescriptions.${key}`);

  return (
    <div
      id="conservation"
      style={{
        padding: "20px 22px",
        border: "1px solid var(--rule)",
        borderRadius: "var(--radius-lg)",
        backgroundColor: `color-mix(in oklab, var(${colorVar}) 7%, var(--bg-raised))`,
        borderLeft: `3px solid var(${colorVar})`,
        position: "relative",
      }}
    >
      <p style={eyebrowStyle}>{t("conservation.eyebrow")}</p>
      <h2 style={h2Style}>{t("conservation.title")}</h2>

      <div
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontFamily: "var(--serif)",
            fontSize: 32,
            fontWeight: 600,
            color: `var(${colorVar})`,
            lineHeight: 1,
            letterSpacing: "-0.01em",
          }}
        >
          {assessment?.category ?? key}
        </span>
        <span
          style={{
            fontFamily: "var(--sans)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--ink)",
          }}
        >
          {label}
        </span>
      </div>

      <p style={{ ...paragraphStyle, maxWidth: 520 }}>{description}</p>

      {assessment && (assessment.criteria || assessment.assessor || assessment.assessment_date) ? (
        <dl
          style={{
            marginTop: 14,
            fontSize: 13,
            color: "var(--ink-2)",
            display: "grid",
            gap: 4,
          }}
        >
          {assessment.criteria ? (
            <DlRow label={t("conservation.criteriaLabel")} value={assessment.criteria} />
          ) : null}
          {assessment.assessor ? (
            <DlRow label={t("conservation.assessorLabel")} value={assessment.assessor} />
          ) : null}
          {assessment.assessment_date ? (
            <DlRow label={t("conservation.assessedLabel")} value={assessment.assessment_date} />
          ) : null}
        </dl>
      ) : null}

      {iucnUrl ? (
        <p style={{ marginTop: 12, fontSize: 14 }}>
          <a
            href={iucnUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={refLinkStyle}
          >
            {t("conservation.viewIucnAssessment")}
          </a>
        </p>
      ) : null}
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
