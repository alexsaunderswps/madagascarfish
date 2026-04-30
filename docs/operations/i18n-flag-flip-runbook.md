# i18n flag-flip runbook (L4 S11)

How to safely turn `NEXT_PUBLIC_FEATURE_I18N_FR=true` on production for the
ABQ BioPark workshop demo, and how to roll back if anything breaks.

> **Decision reminder:** the locale-prefix routes (`/fr/`, `/de/`,
> `/es/`) are served by next-intl middleware **regardless of feature
> flags** — flags only gate the visible `<LocaleSwitcher />` dropdown
> in the header. Flipping `..._FR=true` exposes the language switch
> in the header so visitors can find the French content; the URL
> `/fr/species/<slug>` works either way.

---

## Pre-flip checklist (run all of these BEFORE flipping)

### 1. Review queue is empty (or near-empty) for the demo families

Per L4 / D11, French content is gated by `I18N_ENFORCE_REVIEW_GATE` —
only `human_approved` rows reach the public site. Anything still in
`mt_draft` / `writer_reviewed` falls back to English with the
`(English)` badge. That's the safe default; flipping the flag
without approved content means visitors see English with a French URL.

```bash
# Count rows by status (run in the deployed Django shell):
docker compose exec web python manage.py shell -c "
from i18n.models import TranslationStatus
from django.db.models import Count
rows = TranslationStatus.objects.filter(locale='fr').values('status').annotate(c=Count('id'))
for r in rows: print(r)
"
```

**Pass criterion**: every family planned for the demo has its primary
fields (`distribution_narrative`, `description`) at `human_approved`.
The family list for ABQ is at minimum **Bedotiidae** (the
"Madagascar rainbowfishes" — the demo's banner family) plus any
species the workshop conversation will name.

If a row is missing or stuck, see the corrections workflow:
`docs/handover/i18n-corrections-workflow.md`.

### 2. Smoke test the four key surfaces under `/fr/`

Visit each in a browser (incognito, fresh cookie, no language preference
set in Chrome):

- `/fr/` — homepage, header, hero copy
- `/fr/species` — species index list
- `/fr/species/<bedotiidae-slug>` — a species profile with French content
- `/fr/about` — About page (if shipped) OR `/fr/dashboard` — coordinator landing
- `/fr/login` and `/fr/signup` — auth pages render in French

For each, verify:
- Page chrome (header, footer, nav) is in French.
- Long-form content shows French where approved, English with `(English)`
  badge where not. **Both** outcomes are correct — neither is a bug.
- The URL stays `/fr/...` after navigation (no silent redirect to `/`).

### 3. LocaleSwitcher dropdown shows the right entries

Before the flip:
- `..._I18N=true`, `..._I18N_FR=false` — switcher should NOT render
  (covered by `LocaleSwitcher.test.ts::enabledSwitcherLocales`).

After the flip:
- `..._I18N=true`, `..._I18N_FR=true` — switcher renders with
  `English / Français` options. Selecting Français navigates to
  `/fr/<currentpath>`.

### 4. Email locale resolution

`User.locale` (S7) drives the language for transactional emails (S8).
Smoke-test by registering a test account on `/fr/signup` (the signup
locale gets baked into `User.locale`):

```bash
# After registering a test user, inspect their locale + recent email:
docker compose exec web python manage.py shell -c "
from accounts.models import User
u = User.objects.filter(email='YOUR_TEST_EMAIL').first()
print('locale:', u.locale)
"
```

The verification email subject should be **«Vérifiez votre compte
Madagascar Fish»** if `locale='fr'`.

### 5. Vercel env var changes (production)

Two flags need flipping on Vercel for the production site. Set
**production** scope (not preview):

| Variable                                | Value before | Value after |
| --------------------------------------- | ------------ | ----------- |
| `NEXT_PUBLIC_FEATURE_I18N`              | `true`       | `true`      |
| `NEXT_PUBLIC_FEATURE_I18N_FR`           | `false`      | `true`      |
| `I18N_ENFORCE_REVIEW_GATE` (Django env) | `true`       | `true`      |

`I18N_ENFORCE_REVIEW_GATE` should already be `true` — that's the L3
default for production. If it's not, **do not flip the FR flag yet**;
the review-gate is the safety net that hides un-approved content.

After saving the env vars, redeploy the production app on Vercel
(if Vercel doesn't auto-redeploy on env changes for this project).

### 6. Verify in production

Open `https://malagasyfishes.org/fr/` (or whatever the prod URL is) in
incognito and re-run section 2's smoke test against the live site.
The `(English)` fallback badge appearing on un-approved content is
expected and **not** a rollback trigger.

---

## Rollback procedure

If anything in section 6 looks broken — broken layout, missing strings,
wrong content type rendering — roll back **immediately**. The flag flip
is reversible in seconds.

### Path A: per-locale flag rollback (preferred)

1. On Vercel, set `NEXT_PUBLIC_FEATURE_I18N_FR=false` (production scope).
2. Redeploy if not automatic.
3. The LocaleSwitcher disappears; visitors at `/fr/...` URLs still see
   the page (URL routing is independent of the flag), but no new
   visitors will discover French content via the switcher.
4. Diagnose at leisure on a preview deploy.

### Path B: master flag rollback (if Path A doesn't help)

If French is broken AND English is also broken (something deeper
went wrong with the i18n stack):

1. Set `NEXT_PUBLIC_FEATURE_I18N=false` (production scope).
2. Redeploy.
3. The site falls back to pre-i18n behavior: no LocaleSwitcher,
   English-only chrome, but `/fr/...` URLs may 404 or redirect to
   `/...` depending on middleware state. Verify on staging first if
   possible.

### Path C: review-gate emergency-off (NOT recommended; data leak risk)

If the bug is "approved French content not rendering at all" and you
need to debug whether the gate logic itself is broken:

1. Set `I18N_ENFORCE_REVIEW_GATE=false` on Django prod env.
2. The site will then serve **all** locale content, including
   `mt_draft` rows that haven't been reviewed.
3. **Risks**: un-reviewed conservation-domain prose reaches the public.
4. Use only as a temporary diagnostic; revert as soon as the
   underlying cause is identified.

---

## Sanity checks before declaring success at ABQ

- The Bedotiidae profile pages render French distribution narratives.
- The Spectral / IBM Plex Sans fonts load (no FOUT to system serif).
- Logged-in users with `locale='fr'` see the locale picker on `/account`
  with French as the saved value.
- `/fr/sitemap.xml` lists French URLs with `<xhtml:link>` annotations
  pointing to the other locale variants.
- Search engines can crawl `/fr/...` (check `robots.txt` doesn't block
  the locale prefix).

---

## After-the-flip cleanup (post-ABQ)

If the flip succeeds and stays, two follow-ups land in L5+:
- Translate the German + Spanish placeholders (currently English fallbacks)
- Run the conservation-writer batched review on the remaining families
  beyond Bedotiidae

If the flip rolls back permanently, the `NEXT_PUBLIC_FEATURE_I18N_FR`
env var stays `false` and the L3 review queue work continues silently
until the next demo opportunity.

---

## Related

- L4 spec: `docs/planning/specs/gate-L4-i18n-french-staff.md`
- Operational handover: `docs/handover/i18n-corrections-workflow.md`
- Architecture decisions: `docs/planning/architecture/i18n-architecture.md`
- LocaleSwitcher tests: `frontend/components/LocaleSwitcher.test.ts`
