import "next-auth";
import "next-auth/jwt";

/**
 * NextAuth module augmentation — Gate 11.
 *
 * `tier` is the user's access tier (1-5). It rides on both the JWT and the
 * `Session` because the API enforces tier server-side, so a tampered
 * client-visible value can't elevate access.
 *
 * `drfToken` is JWT-ONLY — never on `Session`. NextAuth's
 * `/api/auth/session` endpoint serializes the session shape to the
 * browser, so any field on `Session` is browser-visible. Server components
 * that need the DRF token call `getServerDrfToken(req)` from
 * `lib/auth.ts`, which reads the JWT directly via `getToken({req})`.
 */
declare module "next-auth" {
  interface Session {
    tier?: number;
    claimStatus?: "none" | "pending" | "approved" | "rejected" | "withdrawn";
  }

  interface User {
    tier?: number;
    drfToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    tier?: number;
    drfToken?: string;
    tierFetchedAt?: number;
    claimStatus?: "none" | "pending" | "approved" | "rejected" | "withdrawn";
  }
}
