"use server";

import { resolveBaseUrl } from "@/lib/api";

/**
 * Signup server action (Gate 11 — Story 1 AC-1.1).
 *
 * The form posts via this server action so the rate-limit IP that reaches
 * Django is the Next.js node's egress IP — deterministic — rather than the
 * browser's. Architecture §6.
 *
 * Enumeration resistance: when Django reports an email already exists, this
 * action returns the same `{ ok: true }` shape it returns on a real success.
 * The browser cannot distinguish a fresh registration from an attempt to
 * register an existing email. Other field-level errors (password strength,
 * invalid email format) surface as `errors` so the form can render them.
 */

export type SignupResult =
  | { ok: true }
  | { ok: false; errors: SignupFieldErrors }
  | { ok: false; transientError: string };

export interface SignupFieldErrors {
  email?: string;
  name?: string;
  password?: string;
  form?: string;
}

interface DjangoFieldErrors {
  email?: string[];
  name?: string[];
  password?: string[];
  detail?: string;
  non_field_errors?: string[];
}

export async function registerAction(input: {
  email: string;
  name: string;
  password: string;
}): Promise<SignupResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const password = input.password;

  if (!email || !name || !password) {
    return {
      ok: false,
      errors: { form: "Email, name, and password are all required." },
    };
  }

  let response: Response;
  try {
    response = await fetch(`${resolveBaseUrl()}/api/v1/auth/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password }),
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      transientError:
        "Could not reach the server. Check your connection and try again.",
    };
  }

  if (response.status === 201) {
    return { ok: true };
  }

  if (response.status === 400) {
    let body: DjangoFieldErrors;
    try {
      body = (await response.json()) as DjangoFieldErrors;
    } catch {
      return {
        ok: false,
        errors: { form: "Sign-up failed. Please check your details and try again." },
      };
    }

    // Enumeration resistance (Story 1 AC-1.1): silence ALL email-field
    // errors. The most common is "An account with this email already
    // exists.", which directly leaks account existence. Banned-domain or
    // format-policy errors also reveal platform internals. The browser's
    // type=email + required already catches malformed input before submit,
    // so any email error reaching here would have to come from Django,
    // and the safer default is the "Check your email" interstitial.
    //
    // Other field errors (name, password) DO surface — Django's password
    // validators (length, common-password, similarity) produce actionable
    // feedback that doesn't reveal account existence.
    const errors: SignupFieldErrors = {};
    if (Array.isArray(body.name) && body.name.length > 0) {
      errors.name = body.name[0];
    }
    if (Array.isArray(body.password) && body.password.length > 0) {
      errors.password = body.password[0];
    }
    if (Array.isArray(body.non_field_errors) && body.non_field_errors.length > 0) {
      errors.form = body.non_field_errors[0];
    }
    if (Object.keys(errors).length === 0) {
      // Either the only error was on the email field (silenced above) or
      // Django returned an unrecognized 400 shape. Both collapse to the
      // success-shaped interstitial — no information leak either way.
      return { ok: true };
    }
    return { ok: false, errors };
  }

  return {
    ok: false,
    transientError: "The server is unavailable. Please try again in a moment.",
  };
}
