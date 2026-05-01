"use client";

import { useTranslations } from "next-intl";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import { Link } from "@/i18n/routing";
import { djangoLogoutAction } from "@/app/[locale]/account/actions";

/**
 * Compact account control for the global header.
 *
 * Anonymous + flag-on: renders a "Sign in" link followed by a "Sign up"
 * pill. Anonymous + flag-off: renders nothing.
 *
 * Authenticated: renders an avatar circle (first letter of email) that
 * opens a popover with the user email, a link to /account, and a Sign
 * out button. Locale picking lives on /account; doubling it into the
 * popover would force this component to dynamic-render the locale list.
 */

const ITEM_HEIGHT = 36;

export interface AccountMenuProps {
  authVisible?: boolean;
}

export default function AccountMenu({ authVisible = false }: AccountMenuProps) {
  const t = useTranslations("nav");
  const tAccount = useTranslations("account");
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", handlePointer);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (status === "loading") {
    // Reserve a minimal slot so the header height doesn't twitch when
    // session resolves.
    return <div style={{ width: 36, height: 36 }} aria-hidden />;
  }

  const authenticated = status === "authenticated";

  if (!authenticated) {
    if (!authVisible) return null;
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Link href="/login" style={SIGN_IN_LINK_STYLE}>
          {t("signIn")}
        </Link>
        <Link href="/signup" style={SIGN_UP_PILL_STYLE}>
          {t("signUp")}
        </Link>
      </div>
    );
  }

  const email = session?.user?.email ?? "";
  const initial = email ? email.charAt(0).toUpperCase() : "?";

  async function handleSignOut() {
    setOpen(false);
    // Best-effort dual fire — match the previous logout behaviour.
    await djangoLogoutAction();
    await signOut({ callbackUrl: "/" });
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        aria-label={tAccount("signOut")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={AVATAR_BUTTON_STYLE}
      >
        {initial}
      </button>
      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            minWidth: 220,
            padding: "8px 0",
            borderRadius: 10,
            border: "1px solid var(--rule)",
            backgroundColor: "var(--bg-raised)",
            boxShadow:
              "0 1px 2px rgba(0,0,0,0.04), 0 6px 18px rgba(0,0,0,0.08)",
            zIndex: 50,
          }}
        >
          {email ? (
            <p
              style={{
                margin: "4px 14px 8px",
                fontSize: 12,
                color: "var(--ink-3)",
                wordBreak: "break-all",
              }}
            >
              {email}
            </p>
          ) : null}
          <Link
            href="/account"
            role="menuitem"
            style={MENU_ITEM_STYLE}
            onClick={() => setOpen(false)}
          >
            {t("account")}
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            style={{
              // `font: inherit` first to clear the user-agent button
              // shorthand (often system-ui at the platform default size);
              // the explicit MENU_ITEM_STYLE below then re-asserts
              // fontFamily / fontSize / lineHeight so the button reads
              // identical to the sibling Account <a>. Without this
              // ordering, the `font` shorthand wins last-write and the
              // button renders larger than the link.
              font: "inherit",
              ...MENU_ITEM_STYLE,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              width: "100%",
              textAlign: "left",
            }}
          >
            {t("signOut")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

const AVATAR_BUTTON_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: "1px solid var(--rule)",
  backgroundColor: "var(--bg-raised)",
  fontFamily: "var(--sans)",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--ink)",
  cursor: "pointer",
  padding: 0,
};

const MENU_ITEM_STYLE: React.CSSProperties = {
  display: "block",
  padding: `0 14px`,
  height: ITEM_HEIGHT,
  lineHeight: `${ITEM_HEIGHT}px`,
  fontFamily: "var(--sans)",
  fontSize: 13,
  color: "var(--ink)",
  textDecoration: "none",
};

const SIGN_IN_LINK_STYLE: React.CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 13,
  color: "var(--ink-2)",
  textDecoration: "none",
  padding: "6px 8px",
};

const SIGN_UP_PILL_STYLE: React.CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--bg-raised)",
  backgroundColor: "var(--accent)",
  textDecoration: "none",
  padding: "6px 12px",
  borderRadius: 999,
};
