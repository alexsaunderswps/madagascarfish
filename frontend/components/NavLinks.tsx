"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

import { djangoLogoutAction } from "@/app/account/actions";

export interface NavLink {
  href: string;
  label: string;
}

export interface AuthNavItem {
  kind: "link" | "logout";
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

/**
 * Compute the auth-side nav items based on the feature flag and session
 * presence. Pure function so a unit test can assert AC-3.3 (flag OFF →
 * nothing rendered) and the authenticated/unauthenticated branches.
 *
 * Flag OFF → empty list. Flag ON + no session → Login + Sign up.
 * Flag ON + session → Account + Sign out.
 */
export function authNavItems(
  authVisible: boolean,
  authenticated: boolean,
): AuthNavItem[] {
  if (!authVisible) return [];
  if (!authenticated) {
    return [
      { kind: "link", href: "/login", label: "Sign in" },
      { kind: "link", href: "/signup", label: "Sign up" },
    ];
  }
  return [
    { kind: "link", href: "/account", label: "Account" },
    { kind: "logout", href: "#logout", label: "Sign out" },
  ];
}

const ITEM_BASE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 44,
  padding: "6px 14px",
  borderRadius: 999,
  fontFamily: "var(--sans)",
  fontSize: 13,
  lineHeight: 1,
  textDecoration: "none",
  transition: "background-color 120ms ease, color 120ms ease",
};

function itemStyle(active: boolean): React.CSSProperties {
  return {
    ...ITEM_BASE_STYLE,
    fontWeight: active ? 600 : 500,
    color: active ? "var(--accent-2)" : "var(--ink-2)",
    backgroundColor: active ? "var(--accent-soft)" : "transparent",
  };
}

async function performLogout(): Promise<void> {
  // Best-effort dual fire: delete the DRF token server-side, then clear the
  // NextAuth cookie. Even if the Django call fails (network blip), the
  // cookie still clears so the user is logged out from the browser.
  await djangoLogoutAction();
  await signOut({ callbackUrl: "/" });
}

export interface NavLinksProps {
  authVisible?: boolean;
}

export default function NavLinks({ authVisible = false }: NavLinksProps = {}) {
  const pathname = usePathname() ?? "/";
  const activeHref = mostSpecificActiveHref(pathname, PRIMARY_NAV);
  // Resolve auth state client-side so the server-rendered HTML stays static
  // (preserves ISR for the public surface). During hydration `status` is
  // "loading" — render no auth nav items in that state to avoid a flash of
  // "Sign in" links for an already-signed-in user.
  const { status } = useSession();
  const authenticated = status === "authenticated";
  const authResolved = status !== "loading";
  const authItems = authResolved ? authNavItems(authVisible, authenticated) : [];

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
              style={itemStyle(active)}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
      {authItems.length > 0 ? (
        <li
          aria-hidden="true"
          style={{ width: 1, height: 18, backgroundColor: "var(--rule)" }}
        />
      ) : null}
      {authItems.map((item) => {
        if (item.kind === "logout") {
          return (
            <li key="logout">
              <button
                type="button"
                onClick={performLogout}
                style={{
                  ...itemStyle(false),
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                {item.label}
              </button>
            </li>
          );
        }
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              style={itemStyle(active)}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
