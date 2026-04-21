"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavLink {
  href: string;
  label: string;
}

export const PRIMARY_NAV: NavLink[] = [
  { href: "/dashboard/", label: "Dashboard" },
  { href: "/map/", label: "Map" },
  { href: "/species/", label: "Species Directory" },
  { href: "/about/", label: "About" },
];

export function isActive(pathname: string, href: string): boolean {
  const normalizedHref = href.endsWith("/") ? href : `${href}/`;
  const normalizedPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (normalizedHref === "/") {
    return normalizedPath === "/";
  }
  return (
    normalizedPath === normalizedHref ||
    normalizedPath.startsWith(normalizedHref)
  );
}

export default function NavLinks() {
  const pathname = usePathname() ?? "/";
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
        const active = isActive(pathname, link.href);
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
