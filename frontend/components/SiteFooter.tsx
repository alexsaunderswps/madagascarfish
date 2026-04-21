import Link from "next/link";

const REPO_URL = "https://github.com/alexsaunderswps/madagascarfish";

type FooterColumn = {
  heading: string;
  links: Array<{ label: string; href: string; external?: boolean }>;
};

const COLUMNS: FooterColumn[] = [
  {
    heading: "Platform",
    links: [
      { label: "Species Directory", href: "/species/" },
      { label: "Distribution Map", href: "/map/" },
      { label: "Conservation Dashboard", href: "/dashboard/" },
    ],
  },
  {
    heading: "Data",
    links: [
      { label: "IUCN Red List", href: "https://www.iucnredlist.org/", external: true },
      { label: "FishBase", href: "https://www.fishbase.se/", external: true },
      { label: "GBIF", href: "https://www.gbif.org/", external: true },
      { label: "CARES Preservation", href: "https://carespreservation.com/", external: true },
    ],
  },
  {
    heading: "About",
    links: [
      { label: "About the Platform", href: "/about/" },
      { label: "Data Sources", href: "/about/data/" },
      { label: "Glossary", href: "/about/glossary/" },
    ],
  },
  {
    heading: "Contribute",
    links: [
      { label: "Husbandry Reports", href: "/contribute/husbandry/" },
      { label: "GitHub", href: REPO_URL, external: true },
    ],
  },
];

const linkStyle = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 32,
  color: "var(--ink-2)",
  textDecoration: "none",
  transition: "color 120ms ease",
} as const;

export default function SiteFooter() {
  return (
    <footer
      style={{
        marginTop: 96,
        borderTop: "1px solid var(--rule)",
        backgroundColor: "var(--bg-sunken)",
      }}
    >
      <div
        style={{
          margin: "0 auto",
          maxWidth: 1152,
          padding: "48px 28px 40px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 40,
          }}
        >
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <p className="eyebrow" style={{ marginBottom: 12 }}>
                {col.heading}
              </p>
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  fontSize: 13,
                }}
              >
                {col.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        style={linkStyle}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} style={linkStyle}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 40,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            borderTop: "1px solid var(--rule)",
            paddingTop: 24,
            fontSize: 12,
            color: "var(--ink-3)",
          }}
        >
          <p style={{ margin: 0 }}>
            Madagascar Freshwater Fish Conservation Platform — Apache-2.0
          </p>
          <p style={{ margin: 0 }}>
            Data mirrored from IUCN, FishBase, GBIF, ZIMS, SHOAL, and CARES.
          </p>
        </div>
      </div>
    </footer>
  );
}
