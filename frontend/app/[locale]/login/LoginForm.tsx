"use client";

import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { safeRedirectTarget } from "@/lib/auth-allowlist";

const FIELD_STYLE = "block w-full rounded border border-slate-300 px-3 py-2 text-sm";
const LABEL_STYLE = "mb-1 block text-sm font-medium text-slate-700";
const BUTTON_STYLE =
  "inline-flex w-full justify-center rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60";

/**
 * Credentials login form (Gate 11 — Story 1 AC-1.3).
 *
 * Posts via NextAuth's `signIn("credentials")`. Honors `?callbackUrl=`
 * after running it through the open-redirect allow-list.
 *
 * Surfaces a single generic copy on failure regardless of whether the
 * underlying response was 401 (bad credentials), 429 (rate limited), or a
 * network-down scenario — preserves the account-enumeration resistance
 * that Django enforces server-side.
 */
export default function LoginForm() {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    setSubmitting(false);

    if (!result || result.error) {
      // result.error is `"CredentialsSignin"` for both 401 and 429 — by
      // design. We never branch UI on the server's specific failure shape.
      setError(t("errorInvalid"));
      return;
    }

    const target = safeRedirectTarget(searchParams.get("callbackUrl"));
    router.push(target);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label={t("formAriaLabel")}>
      <div>
        <label htmlFor="login-email" className={LABEL_STYLE}>
          {t("emailLabel")}
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={FIELD_STYLE}
        />
      </div>
      <div>
        <label htmlFor="login-password" className={LABEL_STYLE}>
          {t("passwordLabel")}
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={FIELD_STYLE}
        />
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={submitting} className={BUTTON_STYLE}>
        {submitting ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
