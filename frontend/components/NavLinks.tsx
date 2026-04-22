"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavLink {
  href: string;
  label: string;
}

export const PRIMARY_NAV: NavLink[] = [
  { href: "/dashboard/", label: "Dashboard" },
  { href: "/dashboard/coordinator/", label: "Coordinator" },
  { href: "/map/", label: "Map" },
  { href: "/species/", label: "Species Directory" },
  { href: "/about/", label: "About" },
];

function normalize(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}

export function isActive(pathname: string, href: string): boolean {
  const normalizedHref = normalize(href);
  const normalizedPath = normalize(pathname);
  if (normalizedHref === "/") {
    return normalizedPath === "/";
  }
  return (
    normalizedPath === normalizedHref ||
    normalizedPath.startsWith(normalizedHref)
  );
}

/**
 * Pick the single nav link most specific to this pathname. When two links
 * both match (e.g. `/dashboard/` and `/dashboard/coordinator/` both match
 * `/dashboard/coordinator/`), the longer href wins. This keeps the parent
 * link from lighting up when you're actually on a nested page.
 */
export function mostSpecificActiveHref(
  pathname: string,
  links: readonly NavLink[],
): string | null {
  let winner: NavLink | null = null;
  for (const link of links) {
    if (!isActive(pathname, link.href)) continue;
    if (winner === null || link.href.length > winner.href.length) {
      winner = link;
    }
  }
  return winner?.href ?? null;
}

export default function NavLinks() {
  const pathname = usePathname() ?? "/";
  const activeHref = mostSpecificActiveHref(pathname, PRIMARY_NAV);
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "4px 16px",
      }}
    >
      {PRIMARY_NAV.map((link) => {
        const active = activeHref === link.href;
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 44,
                padding: "6px 14px",
                borderRadius: 999,
                fontFamily: "var(--sans)",
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                lineHeight: 1,
                textDecoration: "none",
                color: active ? "var(--accent-2)" : "var(--ink-2)",
                backgroundColor: active ? "var(--accent-soft)" : "transparent",
                transition: "background-color 120ms ease, color 120ms ease",
              }}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
