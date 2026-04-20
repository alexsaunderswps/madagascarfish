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

export default function SiteFooter() {
  return (
    <footer
      className="mt-24 border-t border-slate-200"
      style={{ backgroundColor: "var(--bg-sunken)" }}
    >
      <div className="mx-auto max-w-6xl px-7 pb-10 pt-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <p className="eyebrow mb-3">{col.heading}</p>
              <ul className="flex flex-col gap-2 text-[13px] text-slate-700">
                {col.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-sky-700"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="hover:text-sky-700">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-slate-200 pt-6 text-[12px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Madagascar Freshwater Fish Conservation Platform — Apache-2.0</p>
          <p className="sm:text-right">
            Data mirrored from IUCN, FishBase, GBIF, ZIMS, SHOAL, and CARES.
          </p>
        </div>
      </div>
    </footer>
  );
}
