/**
 * Canonical types for the `/api/v1/auth/me/` response.
 *
 * Defined here (not inlined into each consumer page) so a backend-side
 * change to `UserProfileSerializer` shows up at every consumer at compile
 * time. Pages narrowing to a subset should `Pick<...>` from `MeResponse`
 * rather than redeclare a partial shape.
 */

export interface InstitutionMembership {
  institution_id: number | null;
  institution_name: string | null;
  claim_status: "none" | "pending" | "approved" | "rejected" | "withdrawn";
  claim_id: number | null;
  claim_requested_at: string | null;
  claim_reviewed_at: string | null;
  rejection_reason: string | null;
}

export interface MeResponse {
  id: number;
  email: string;
  name: string;
  access_tier: number;
  institution: number | null;
  institution_membership?: InstitutionMembership;
  is_active: boolean;
  date_joined: string;
  locale?: string;
}
