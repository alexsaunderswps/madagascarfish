import Link from "next/link";

import NavLinks from "./NavLinks";

/**
 * Server-rendered, static. Auth state is resolved client-side in `NavLinks`
 * via `useSession()` so the public surface stays fully cacheable (ISR) —
 * reading the session cookie here would force every page that consumes the
 * root layout into dynamic rendering.
 */
export default function SiteHeader() {
  const authVisible = process.env.NEXT_PUBLIC_FEATURE_AUTH === "true";

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        borderBottom: "1px solid var(--rule)",
        backgroundColor: "color-mix(in oklab, var(--bg-raised) 90%, transparent)",
        backdropFilter: "saturate(140%) blur(8px)",
        WebkitBackdropFilter: "saturate(140%) blur(8px)",
      }}
    >
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>
      <div
        style={{
          margin: "0 auto",
          maxWidth: 1152,
          height: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          padding: "0 28px",
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "var(--serif)",
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: "var(--ink)",
            textDecoration: "none",
          }}
        >
          Madagascar Freshwater Fish
        </Link>
        <nav aria-label="Primary">
          <NavLinks authVisible={authVisible} />
        </nav>
      </div>
    </header>
  );
}
