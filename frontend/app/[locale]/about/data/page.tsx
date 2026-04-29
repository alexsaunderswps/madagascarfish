import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about.data");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export const revalidate = 3600;

const EYEBROW_STYLE: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--ink-3)",
};

const H2_STYLE: CSSProperties = {
  margin: 0,
  fontFamily: "var(--serif)",
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: "var(--ink)",
  lineHeight: 1.2,
};

const BODY_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 15,
  lineHeight: 1.65,
  color: "var(--ink-2)",
};

const LINK_STYLE: CSSProperties = {
  color: "var(--accent-2)",
  textDecoration: "none",
  borderBottom:
    "1px solid color-mix(in oklab, var(--accent-2) 35%, transparent)",
};

const LIST_STYLE: CSSProperties = {
  ...BODY_STYLE,
  margin: 0,
  paddingLeft: 20,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={EYEBROW_STYLE}>{eyebrow}</p>
      <h2 style={H2_STYLE}>{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </div>
    </section>
  );
}

export default async function DataHandlingPage() {
  const t = await getTranslations("about.data");

  return (
    <>
      <section
        style={{
          backgroundColor: "var(--bg-sunken)",
          borderBottom: "1px solid var(--rule)",
        }}
      >
        <div
          style={{
            maxWidth: 880,
            margin: "0 auto",
            padding: "56px 32px 40px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <p style={EYEBROW_STYLE}>
            <Link href="/about/" style={{ color: "inherit", textDecoration: "none" }}>
              {t("backToAbout")}
            </Link>
          </p>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--serif)",
              fontSize: 36,
              fontWeight: 600,
              letterSpacing: "-0.015em",
              color: "var(--ink)",
              lineHeight: 1.15,
            }}
          >
            {t("title")}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 16,
              lineHeight: 1.55,
              color: "var(--ink-2)",
              maxWidth: 720,
            }}
          >
            {t("intro")}
          </p>
        </div>
      </section>

      <main
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "48px 32px 96px",
          display: "flex",
          flexDirection: "column",
          gap: 40,
        }}
      >
        <Section eyebrow={t("sources.eyebrow")} title={t("sources.title")}>
          <p style={BODY_STYLE}>{t("sources.lead")}</p>
          <ul style={LIST_STYLE}>
            <li>
              <strong>{t("sources.iucnPrefix")}</strong>
              {t("sources.iucnBody")}
            </li>
            <li>
              <strong>{t("sources.fishbasePrefix")}</strong>
              {t("sources.fishbaseBody")}
            </li>
            <li>
              <strong>{t("sources.gbifPrefix")}</strong>
              {t("sources.gbifBody")}
            </li>
            <li>
              <strong>{t("sources.caresPrefix")}</strong>
              {t("sources.caresBody")}
            </li>
            <li>
              <strong>{t("sources.shoalPrefix")}</strong>
              {t("sources.shoalBody")}
            </li>
            <li>
              <strong>{t("sources.expertPrefix")}</strong>
              {t("sources.expertBody")}
            </li>
          </ul>
        </Section>

        <Section eyebrow={t("policy.eyebrow")} title={t("policy.title")}>
          <p style={BODY_STYLE}>{t("policy.para1")}</p>
          <p style={BODY_STYLE}>{t("policy.para2")}</p>
        </Section>

        <Section eyebrow={t("geography.eyebrow")} title={t("geography.title")}>
          <p style={BODY_STYLE}>{t("geography.para1")}</p>
          <p style={BODY_STYLE}>{t("geography.para2")}</p>
        </Section>

        <Section eyebrow={t("caveats.eyebrow")} title={t("caveats.title")}>
          <p style={BODY_STYLE}>{t("caveats.lead")}</p>
          <ul style={LIST_STYLE}>
            <li>
              <strong>{t("caveats.transcriptionPrefix")}</strong>
              {t("caveats.transcriptionBody")}
            </li>
            <li>
              <strong>{t("caveats.undescribedPrefix")}</strong>
              {t("caveats.undescribedBody1")}
              <em>{t("caveats.undescribedExample")}</em>
              {t("caveats.undescribedBody2")}
            </li>
            <li>
              <strong>{t("caveats.introducedPrefix")}</strong>
              {t("caveats.introducedBody")}
            </li>
            <li>
              <strong>{t("caveats.husbandryPrefix")}</strong>
              {t("caveats.husbandryBody")}
            </li>
          </ul>
        </Section>

        <Section eyebrow={t("access.eyebrow")} title={t("access.title")}>
          <p style={BODY_STYLE}>{t("access.lead")}</p>
          <ul style={LIST_STYLE}>
            <li>{t("access.item1")}</li>
            <li>{t("access.item2")}</li>
            <li>{t("access.item3")}</li>
            <li>{t("access.item4")}</li>
          </ul>
          <p style={BODY_STYLE}>{t("access.trailing")}</p>
        </Section>

        <Section eyebrow={t("interop.eyebrow")} title={t("interop.title")}>
          <p style={BODY_STYLE}>{t("interop.body")}</p>
        </Section>

        <Section eyebrow={t("feedback.eyebrow")} title={t("feedback.title")}>
          <p style={BODY_STYLE}>
            {t.rich("feedback.body", {
              aboutLink: (chunks) => (
                <Link href="/about/" style={LINK_STYLE}>
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </Section>
      </main>
    </>
  );
}
