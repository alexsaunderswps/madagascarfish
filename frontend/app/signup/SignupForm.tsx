"use client";

import { useState, type FormEvent } from "react";

import { registerAction, type SignupFieldErrors } from "./actions";

const FIELD_STYLE = "block w-full rounded border border-slate-300 px-3 py-2 text-sm";
const LABEL_STYLE = "mb-1 block text-sm font-medium text-slate-700";
const BUTTON_STYLE =
  "inline-flex w-full justify-center rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<SignupFieldErrors>({});
  const [transientError, setTransientError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setTransientError(null);

    const result = await registerAction({ email, name, password });

    setSubmitting(false);

    if (result.ok) {
      setSubmitted(true);
      return;
    }
    if ("transientError" in result) {
      setTransientError(result.transientError);
      return;
    }
    setErrors(result.errors);
  }

  if (submitted) {
    return (
      <div
        role="status"
        className="rounded border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900"
      >
        <p className="font-medium">Check your email.</p>
        <p className="mt-2">
          If an account can be created with that address, we&rsquo;ve sent a
          verification link. The link is valid for 48 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Sign-up form" noValidate>
      <div>
        <label htmlFor="signup-email" className={LABEL_STYLE}>
          Email
        </label>
        <input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={errors.email ? "true" : undefined}
          aria-describedby={errors.email ? "signup-email-error" : undefined}
          className={FIELD_STYLE}
        />
        {errors.email ? (
          <p id="signup-email-error" className="mt-1 text-sm text-red-700">
            {errors.email}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="signup-name" className={LABEL_STYLE}>
          Name
        </label>
        <input
          id="signup-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={errors.name ? "true" : undefined}
          aria-describedby={errors.name ? "signup-name-error" : undefined}
          className={FIELD_STYLE}
        />
        {errors.name ? (
          <p id="signup-name-error" className="mt-1 text-sm text-red-700">
            {errors.name}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="signup-password" className={LABEL_STYLE}>
          Password
        </label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={errors.password ? "true" : undefined}
          aria-describedby={
            errors.password ? "signup-password-error" : "signup-password-hint"
          }
          className={FIELD_STYLE}
        />
        <p id="signup-password-hint" className="mt-1 text-xs text-slate-500">
          At least 12 characters. Avoid common passwords and information from
          your email or name.
        </p>
        {errors.password ? (
          <p id="signup-password-error" className="mt-1 text-sm text-red-700">
            {errors.password}
          </p>
        ) : null}
      </div>

      {errors.form ? (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {errors.form}
        </p>
      ) : null}
      {transientError ? (
        <p
          role="alert"
          className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          {transientError}
        </p>
      ) : null}

      <button type="submit" disabled={submitting} className={BUTTON_STYLE}>
        {submitting ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
