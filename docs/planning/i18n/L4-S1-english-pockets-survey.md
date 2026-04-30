# L4 S1 — English-pocket survey (2026-04-30)

Inventory of hardcoded English strings in the three pockets CLAUDE.md i18n
rule #3 names. Drives S2 / S3 / S4 implementation scope.

**Total: 55+ leaks across 3 pockets, 11 files.**

| Pocket | File count | String count | Story |
| ------ | ---------- | ------------ | ----- |
| 1. Server-action errors    | 2  | 7   | S2 |
| 2. `lib/husbandry` helpers | 1  | 9   | S3 |
| 3. Django backend          | 8+ | 39+ | S4 |

---

## Pocket 1 — Server-action error strings (S2)

### `frontend/app/[locale]/signup/actions.ts`

| Line | String | Context | Fix |
| ---- | ------ | ------- | --- |
| 51   | `"Email, name, and password are all required."` | registerAction validation | `getTranslations()` |
| 67   | `"Could not reach the server. Check your connection and try again."` | network failure | `getTranslations()` |
| 82   | `"Sign-up failed. Please check your details and try again."` | 400 fallback | `getTranslations()` |
| 118  | `"The server is unavailable. Please try again in a moment."` | 5xx fallback | `getTranslations()` |

### `frontend/app/api/revalidate/route.ts`

| Line | String | Context | Fix |
| ---- | ------ | ------- | --- |
| 23   | `"server is not configured for revalidation"` | API error response | symbolic token |
| 33   | `"invalid JSON body"` | API validation error | symbolic token |
| 40   | `"unauthorized"` | API authentication failure | symbolic token |

**Note:** `revalidate/route.ts` is internal-machinery infrastructure. Symbolic
token approach (return `{ error: "REVALIDATE_NOT_CONFIGURED" }` etc.) lets
the caller — usually Django admin — translate at display time.

---

## Pocket 2 — `lib/husbandry` helpers (S3)

### `frontend/lib/husbandry.ts`

| Line | String | Context | Fix |
| ---- | ------ | ------- | --- |
| 150–156 | `"Adult size"`, `"Space demand"`, `"Temperament challenge"`, `"Water parameter demand"`, `"Dietary specialization"`, `"Breeding complexity"`, `"Other"` | DIFFICULTY_FACTOR_ORDER constant | enum tokens + client-side `t()` mapping |
| 209  | `"CARES + SHOAL priority"` | teaserPresentation chip | enum token |
| 211  | `"CARES breeder priority"` | teaserPresentation chip | enum token |
| 213  | `"SHOAL priority"` | teaserPresentation chip | enum token |
| 227  | `"A CARES / SHOAL priority species."` | teaserSentence return | enum token |
| 230  | `"A CARES priority species."` | teaserSentence return | enum token |
| 233  | `"A SHOAL priority species."` | teaserSentence return | enum token |
| 235  | `"Guidance on keeping this species, drawn from keepers and published sources."` | teaserSentence default | enum token |

**Implementation pattern (per L4 spec S3):**

```ts
// frontend/lib/husbandry.ts
export const DIFFICULTY_FACTOR_TOKENS = [
  "adult_size", "space_demand", "temperament", "water_params",
  "dietary", "breeding_complexity", "other",
] as const;

export type DifficultyFactorToken = typeof DIFFICULTY_FACTOR_TOKENS[number];

// teaserPresentation returns tokens, not strings
export type TeaserBadgeToken =
  | "cares_shoal_priority" | "cares_priority" | "shoal_priority" | "guidance_default";

// Component (with t() access) maps token -> rendered string
```

Catalog keys land under `husbandry.difficulty.<token>` and `husbandry.teaser.<token>` in `frontend/messages/*.json`.

---

## Pocket 3 — Django backend (S4)

All fixes use `from django.utils.translation import gettext_lazy as _` and wrap each string.

### `backend/accounts/serializers.py`

| Line | String | Context |
| ---- | ------ | ------- |
| 16 | `"An account with this email already exists."` | RegisterSerializer.validate_email |

### `backend/accounts/views.py`

| Line | String | Context |
| ---- | ------ | ------- |
| 93   | `"Verify your Madagascar Fish account"` | email subject |
| 94   | `"Click to verify your account: {verification_url}"` | email body |
| 101  | `"Registration successful. Check your email to verify your account."` | register response |
| 112  | `"Missing verification token."` | verify_email |
| 120  | `"Verification link has expired."` | SignatureExpired |
| 125  | `"Invalid verification token."` | BadSignature |
| 133  | `"Invalid verification token."` | User.DoesNotExist |
| 138  | `"Account already verified."` | already active |
| 143  | `"Account verified successfully."` | success |
| 153  | `"Too many login attempts. Try again in 15 minutes."` | rate limit |
| 167  | `"Invalid email or password."` | auth failure |
| 186  | `"Logged out successfully."` | logout |

**Note:** Lines 93–94 (email subject/body) become template-driven in S8;
they're listed here because they currently exist as inline strings.

### `backend/accounts/models.py`

| Line | String | Context |
| ---- | ------ | ------- |
| 45 | `"1=Public, 2=Researcher, 3=Coordinator, 4=Program Manager, 5=Admin"` | User.access_tier help_text |
| 57 | `"Inactive until manually activated or email-verified."` | User.is_active help_text |

### `backend/species/admin.py`

| Line | String | Context |
| ---- | ------ | ------- |
| 55 | `` `{field}` is required when source is `manual_expert`. `` | ConservationAssessmentAdminForm.clean |
| 59 | `` `reason` is required when creating a manual_expert assessment. `` | form validation |
| 336 | `"No audit entries recorded."` | recent_iucn_status_audit |
| 427 | `"Tier 3 (Conservation Coordinator) or higher is required to author a manual_expert assessment."` | PermissionDenied |

### `backend/species/admin_revalidate.py`

| Line | String | Context |
| ---- | ------ | ------- |
| 40–41 | `"Revalidate is not configured: …"` | _post_revalidate |
| 52 | `f"Revalidate timed out after {timeout}s — check frontend health."` | Timeout |
| 54 | `f"Revalidate request failed: {exc}"` | RequestException |
| 57 | `f"Revalidate returned HTTP {response.status_code}: {response.text[:200]}"` | HTTP error |
| 62 | `f"Revalidate succeeded (HTTP {response.status_code}, non-JSON body)."` | success |
| 66 | `f"Revalidated {len(revalidated)} path(s)."` | summary |
| 68 | `f"{len(failures)} path(s) failed: {failures}"` | failure summary |

**Note:** f-strings need `gettext_lazy("Revalidate timed out after %(t)ss — check frontend health.") % {"t": timeout}` form. Or use lazy interpolation pattern.

### `backend/husbandry/admin.py`

| Line | String | Context |
| ---- | ------ | ------- |
| 181 | `"Review is overdue; public page will show a 'review pending' note."` | messages.warning |
| 202 | `"last_reviewed_by is required to publish."` | save_related |
| 204 | `"last_reviewed_at is required to publish."` | save_related |
| 206 | `"At least one source citation is required to publish."` | save_related |

### `backend/husbandry/models.py`

| Line | String | Context |
| ---- | ------ | ------- |
| 145 | `"Species husbandry record"` | verbose_name |
| 146 | `"Species husbandry records"` | verbose_name_plural |
| 178 | `"A reviewer is required to publish a husbandry record."` | clean |
| 180–181 | `"A review date is required to publish a husbandry record."` | clean |
| 53 | `"Gates public API + frontend teaser. Draft records are invisible to the public."` | help_text |
| 126 | `"Free text at MVP. Structured contributor records are post-MVP (BA §5)."` | help_text |
| 134 | `"Required when published=True."` | help_text |
| 137 | `"Required when published=True."` | help_text |

### `backend/populations/admin.py`

| Line | String | Context |
| ---- | ------ | ------- |
| 125 | `"You can only modify records for your own institution."` | PermissionDenied |
| 128 | `"You can only create records for your own institution."` | PermissionDenied |

---

## Exclusions / non-leaks

- `tests/` and migration files — infrastructure, not user-facing.
- `console.error()` / log strings without user visibility.
- `i18n/admin.py` — already wraps with `_()` (`gettext_lazy`); no leaks.
- Third-party package strings (DRF, Django, modeltranslation defaults).

## Implementation order

1. **S2** — Smallest pocket, validates `getTranslations()` + symbolic-token pattern. ~7 strings, 2 files. Half-day.
2. **S3** — `lib/husbandry` token refactor. Touches every consumer of teaser-related helpers (audit needed). Day.
3. **S4** — Django `gettext_lazy` sweep + `makemessages` + initial `.po` translation. Two days. The big one.

---

## Related

- Spec: `docs/planning/specs/gate-L4-i18n-french-staff.md`
- Initiative hub: `docs/planning/i18n/README.md`
- Architecture: `docs/planning/architecture/i18n-architecture.md`
- L1 spec (catalog patterns): `docs/planning/i18n/gate-L1-framework.md`
- Code pattern reference: `frontend/i18n/routing.ts`, `frontend/i18n/request.ts`
