import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { Link } from "@/i18n/routing";
import { fetchInstitutionProfile } from "@/lib/fieldPrograms";

// Public, cached. Five-minute revalidation matches the species directory
// and field-programs page — coordinator/keeper edits surface within
// minutes without each visit hammering Django.
export const revalidate = 300;

const INSTITUTION_TYPE_LABELS: Record<string, string> = {
  zoo: "Zoo",
  aquarium: "Aquarium",
  research_org: "Research organisation",
  hobbyist_program: "Hobbyist program",
  hobbyist_keeper: "Hobbyist keeper",
  ngo: "NGO",
  government: "Government",
};

const IUCN_BADGE_STYLES: Record<string, CSSProperties> = {
  CR: { backgroundColor: "#FEE2E2", color: "#991B1B" },
  EN: { backgroundColor: "#FFEDD5", color: "#9A3412" },
  VU: { backgroundColor: "#FEF3C7", color: "#92400E" },
  NT: { backgroundColor: "#FEF9C3", color: "#854D0E" },
  LC: { backgroundColor: "#DCFCE7", color: "#166534" },
  DD: { backgroundColor: "#F1F5F9", color: "#334155" },
  NE: { backgroundColor: "#F1F5F9", color: "#334155" },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return { title: "Institution" };
  }
  const profile = await fetchInstitutionProfile(numericId);
  const t = await getTranslations("publicInstitution");
  if (!profile) {
    return { title: t("metaTitle.fallback") };
  }
  return {
    title: t("metaTitle.named", { name: profile.institution.name }),
    description: t("metaDescription", {
      name: profile.institution.name,
      country: profile.institution.country,
    }),
  };
}

const PAGE_WRAPPER: CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "32px 20px 64px",
  display: "flex",
  flexDirection: "column",
  gap: 28,
};

const EYEBROW: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--ink-3)",
};

const TITLE: CSSProperties = {
  margin: "6px 0 8px",
  fontFamily: "var(--serif)",
  fontSize: 32,
  fontWeight: 600,
  letterSpacing: "-0.015em",
  color: "var(--ink)",
  lineHeight: 1.15,
};

const META_LINE: CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "var(--ink-2)",
};

const STAT_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14,
};

const STAT_TILE: CSSProperties = {
  padding: "16px 18px",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--rule)",
  backgroundColor: "var(--bg-raised)",
};

const STAT_LABEL: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--ink-3)",
};

const STAT_VALUE: CSSProperties = {
  margin: "6px 0 0",
  fontFamily: "var(--serif)",
  fontSize: 28,
  fontWeight: 600,
  color: "var(--ink)",
  lineHeight: 1.1,
};

const SECTION_H2: CSSProperties = {
  margin: "0 0 12px",
  fontFamily: "var(--serif)",
  fontSize: 20,
  fontWeight: 600,
  color: "var(--ink)",
};

const LINK_STYLE: CSSProperties = {
  color: "var(--accent)",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

export default async function InstitutionProfilePage({ params }: PageProps) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    notFound();
  }

  const [t, profile] = await Promise.all([
    getTranslations("publicInstitution"),
    fetchInstitutionProfile(numericId),
  ]);

  if (!profile) {
    notFound();
  }

  const inst = profile.institution;
  const typeLabel = INSTITUTION_TYPE_LABELS[inst.institution_type] ?? inst.institution_type;
  const memberBadges: string[] = [];
  if (inst.zims_member) memberBadges.push("ZIMS");
  if (inst.aza_member) memberBadges.push("AZA");
  if (inst.eaza_member) memberBadges.push("EAZA");

  return (
    <main style={PAGE_WRAPPER}>
      <header>
        <p style={EYEBROW}>{t("eyebrow")}</p>
        <h1 style={TITLE}>{inst.name}</h1>
        <p style={META_LINE}>
          {typeLabel}
          {inst.city ? ` · ${inst.city}` : ""}
          {inst.country ? ` · ${inst.country}` : ""}
        </p>
        {memberBadges.length > 0 ? (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--ink-3)" }}>
            <span style={{ marginRight: 6 }}>{t("memberOf")}</span>
            {memberBadges.map((b) => (
              <span
                key={b}
                style={{
                  display: "inline-block",
                  marginRight: 6,
                  padding: "2px 8px",
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--ink-2)",
                  backgroundColor:
                    "color-mix(in oklab, var(--highlight) 12%, var(--bg))",
                  border: "1px solid var(--rule)",
                }}
              >
                {b}
              </span>
            ))}
          </p>
        ) : null}
        {inst.website ? (
          <p style={{ margin: "8px 0 0", fontSize: 13 }}>
            <a
              href={inst.website}
              target="_blank"
              rel="noopener noreferrer"
              style={LINK_STYLE}
            >
              {t("websiteLink")} ↗
            </a>
          </p>
        ) : null}
      </header>

      <section aria-label={t("stats.ariaLabel")} style={STAT_GRID}>
        <div style={STAT_TILE}>
          <p style={STAT_LABEL}>{t("stats.species")}</p>
          <p style={STAT_VALUE}>{profile.species_held.length}</p>
        </div>
        <div style={STAT_TILE}>
          <p style={STAT_LABEL}>{t("stats.populations")}</p>
          <p style={STAT_VALUE}>{profile.populations_count}</p>
        </div>
        <div style={STAT_TILE}>
          <p style={STAT_LABEL}>{t("stats.programsLed")}</p>
          <p style={STAT_VALUE}>{profile.led_programs.length}</p>
        </div>
        <div style={STAT_TILE}>
          <p style={STAT_LABEL}>{t("stats.partnerPrograms")}</p>
          <p style={STAT_VALUE}>{profile.partner_programs.length}</p>
        </div>
      </section>

      {profile.species_held.length > 0 ? (
        <section>
          <h2 style={SECTION_H2}>{t("speciesHeld.heading")}</h2>
          <p style={{ ...META_LINE, marginBottom: 12 }}>
            {t("speciesHeld.subtitle")}
          </p>
          <ul
            role="list"
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {profile.species_held.map((sp) => {
              const badge =
                IUCN_BADGE_STYLES[sp.iucn_status ?? ""] ?? IUCN_BADGE_STYLES.NE;
              return (
                <li key={sp.id}>
                  <Link
                    href={`/species/${sp.id}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 13,
                      fontStyle: "italic",
                      color: "var(--ink)",
                      backgroundColor: "var(--bg-raised)",
                      border: "1px solid var(--rule)",
                      textDecoration: "none",
                    }}
                  >
                    {sp.scientific_name}
                    {sp.iucn_status ? (
                      <span
                        style={{
                          padding: "1px 6px",
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 600,
                          fontStyle: "normal",
                          ...badge,
                        }}
                      >
                        {sp.iucn_status}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {profile.led_programs.length > 0 ? (
        <ProgramSection
          heading={t("ledPrograms.heading")}
          programs={profile.led_programs}
        />
      ) : null}
      {profile.partner_programs.length > 0 ? (
        <ProgramSection
          heading={t("partnerPrograms.heading")}
          programs={profile.partner_programs}
        />
      ) : null}

      {profile.species_held.length === 0 &&
      profile.led_programs.length === 0 &&
      profile.partner_programs.length === 0 ? (
        <p style={META_LINE}>{t("emptyState")}</p>
      ) : null}
    </main>
  );
}

function ProgramSection({
  heading,
  programs,
}: {
  heading: string;
  programs: { id: number; name: string; status: string }[];
}) {
  return (
    <section>
      <h2 style={SECTION_H2}>{heading}</h2>
      <ul
        role="list"
        style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}
      >
        {programs.map((p) => (
          <li key={p.id}>
            <Link
              href="/field-programs/"
              style={{
                display: "block",
                padding: "10px 14px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--rule)",
                backgroundColor: "var(--bg-raised)",
                color: "var(--ink)",
                textDecoration: "none",
              }}
            >
              <span style={{ fontFamily: "var(--serif)", fontSize: 16 }}>{p.name}</span>
              <span style={{ marginLeft: 8, fontSize: 12, color: "var(--ink-3)" }}>
                · {p.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
