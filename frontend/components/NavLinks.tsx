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
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium">
      {PRIMARY_NAV.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded bg-sky-50 px-2 py-0.5 text-sky-800"
                  : "rounded px-2 py-0.5 text-slate-700 hover:text-sky-700"
              }
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
