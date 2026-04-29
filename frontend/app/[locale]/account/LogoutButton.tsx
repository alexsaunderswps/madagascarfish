"use client";

import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { useState } from "react";

import { djangoLogoutAction } from "./actions";

const BUTTON_STYLE =
  "inline-flex justify-center rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60";

export default function LogoutButton() {
  const t = useTranslations("account");
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    // Best-effort: delete the DRF token server-side. Even if this fails
    // (Django down, network blip), we still clear the NextAuth cookie so
    // the user is logged out from the browser's perspective.
    await djangoLogoutAction();
    await signOut({ callbackUrl: "/" });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={BUTTON_STYLE}
    >
      {busy ? t("signingOut") : t("signOut")}
    </button>
  );
}
