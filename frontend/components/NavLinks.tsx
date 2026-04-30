"use client";

import { useTranslations } from "next-intl";
// Import Link AND usePathname from @/i18n/routing so locale-aware
// navigation works AND the active-pill highlight matches against the
// de-localized path (`/dashboard/` even when URL is `/fr/dashboard/`).
import { Link, usePathname } from "@/i18n/routing";
import { signOut, useSession } from "next-auth/react";

import { djangoLogoutAction } from "@/app/[locale]/account/actions";

export interface NavLink {
  href: string;
  /** i18n key under the `nav` namespace (e.g., "dashboard"). */
  labelKey: string;
  /**
   * Minimum access tier required to see this link in the nav. Omitted means
   * public (visible to anonymous + all tiers). The route itself is gated
   * server-side; this just stops us from rendering a link the visitor can't
   * use, which would bounce them to login.
   */
  minTier?: number;
}

export interface AuthNavItem {
  kind: "link" | "logout";
  href: string;
  /** i18n key under the `nav` namespace. */
  labelKey: string;
}

export const PRIMARY_NAV: NavLink[] = [
  { href: "/dashboard/", labelKey: "dashboard" },
  { href: "/dashboard/coordinator/", labelKey: "coordinator", minTier: 3 },
  { href: "/map/", labelKey: "map" },
  { href: "/species/", labelKey: "speciesDirectory" },
  { href: "/about/", labelKey: "about" },
];

/**
 * Filter nav links by viewer tier. Anonymous viewers are tier 0 here
 * (not 1) so any `minTier` requirement filters them out — Tier 1 in the
 * access model is "public", which already maps to the no-`minTier` case.
 */
export function visibleNavLinks(
  links: readonly NavLink[],
  viewerTier: number,
): NavLink[] {
  return links.filter(
    (link) => link.minTier === undefined || viewerTier >= link.minTier,
  );
}

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
      { kind: "link", href: "/login", labelKey: "signIn" },
      { kind: "link", href: "/signup", labelKey: "signUp" },
    ];
  }
  return [
    { kind: "link", href: "/account", labelKey: "account" },
    { kind: "logout", href: "#logout", labelKey: "signOut" },
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
  const t = useTranslations("nav");
  const pathname = usePathname() ?? "/";
  // Resolve auth state client-side so the server-rendered HTML stays static
  // (preserves ISR for the public surface). During hydration `status` is
  // "loading" — render no auth nav items and treat tier as 0 so links with
  // a `minTier` stay hidden until we know what the viewer can see.
  const { data: session, status } = useSession();
  const authenticated = status === "authenticated";
  const authResolved = status !== "loading";
  const viewerTier =
    authResolved && typeof session?.tier === "number" ? session.tier : 0;
  const primaryLinks = visibleNavLinks(PRIMARY_NAV, viewerTier);
  const activeHref = mostSpecificActiveHref(pathname, primaryLinks);
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
      {primaryLinks.map((link) => {
        const active = activeHref === link.href;
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              style={itemStyle(active)}
            >
              {t(link.labelKey)}
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
                  // `font: inherit` first to clear the user-agent button
                  // default (often system-ui at the platform default size);
                  // then itemStyle's explicit fontFamily / fontSize /
                  // fontWeight / lineHeight win and match the sibling
                  // <a> elements (Sign in / Sign up / Account).
                  font: "inherit",
                  ...itemStyle(false),
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                {t(item.labelKey)}
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
              {t(item.labelKey)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
