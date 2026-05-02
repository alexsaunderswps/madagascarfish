# ABQ ECA Workshop demo script

A walkthrough of the Malagasy Freshwater Fishes Conservation Platform for the
Extinction Crisis ABQ BioPark workshop, June 1–5, 2026.

The script is opinionated: it demos the **loop** (public profile →
institutional inventory → coordinator action → audit trail), not a feature
catalogue. Roughly 12 minutes if you stick to the path; 20 if the room asks
questions.

Staging URL: `https://staging.malagasyfishes.org` (Vercel) +
`https://api.malagasyfishes.org` (Hetzner).

---

## 0 · Pre-demo checklist (run the morning of)

Five minutes, the day of. Don't skip this — most demo failures are pre-flight
problems, not live bugs.

1. **API healthy.** Open <https://api.malagasyfishes.org/api/v1/schema/> in a
   browser tab. Should return the OpenAPI JSON. If it 502s, the Hetzner stack
   needs attention before you walk in.
2. **IUCN dashboard tile is green.** Open
   <https://staging.malagasyfishes.org/dashboard/coordinator> while signed in
   as the coordinator account. The IUCN sync panel should show a recent
   `last_run_at`. If it's stuck on "waiting for first run", trigger the beat
   schedule manually (see `OPERATIONS.md` § Manual IUCN sync).
3. **Three browser windows ready.**
   - Window A — incognito, signed out. The public face.
   - Window B — signed in as the **CARES keeper** demo account
     (Tier 2, institution = "ABQ BioPark", claim approved).
   - Window C — signed in as the **coordinator** demo account
     (Tier 3, institution = "MFFCP Coordination").
4. **Pick the species you'll feature.** Default to `Paretroplus menarambo` —
   it has a real IUCN CR status, real distribution polygon, real ex-situ
   populations across multiple institutions, and a non-empty
   `distribution_narrative` after PR #159. If you pick something else, run
   through the public profile first to confirm there's enough on it to talk to.
5. **Tab order on each window**, in the order you'll click:
   - Window A: `/`, `/species/<id>`, `/map`, `/about`.
   - Window B: `/account`, `/dashboard/staff/populations`,
     `/dashboard/staff/breeding-events`.
   - Window C: `/dashboard/coordinator`,
     `/dashboard/coordinator/transfers`,
     `/dashboard/coordinator/breeding-recommendations`,
     `/dashboard/admin/audit/`.

If Window A's incognito tab keeps logging you in via cookies from another
session, force-close all Chrome incognito windows and reopen — incognito
isn't pristine across sessions.

---

## 1 · Public face — "the data is for everyone first"

**Window A. ~2 minutes.**

Talking arc: this is what a regional zookeeper, a hobbyist, a graduate
student, or a journalist sees with no account. It's the same data the
coordinators see at the top — just with sensitive layers stripped.

1. Land on `/`. Read the hero. Point out:
   - **79 endemic species.** Most freshwater-imperiled vertebrate group on the
     island.
   - **Status badges** are a denormalized mirror of the most-recent IUCN
     assessment, refreshed weekly via the IUCN Red List API. The platform
     never editorializes a status — manual changes route through a
     `ConservationAssessment` row with an assessor name and date.

2. Click into `/species/paretroplus-menarambo` (or whichever species you
   picked). Walk down the page:
   - **Conservation status** block — assessor, year, IUCN URL link out.
   - **Distribution narrative** — prose drafted from primary literature,
     not auto-generated.
   - **Ecology / morphology** sections — same.
   - **Where it's held in captivity** — institution names + countries + an
     aggregated count. **No per-institution counts at Tier 1.** Coordinate
     generalization is an active rule, not a theoretical one.

3. Open `/map`. Toggle the species filter to your featured species. Note:
   - Tier 1 sees coarse polygons; the exact pin only resolves at Tier 3.
   - This is GBIF-aligned coordinate-generalization for sensitive species,
     not a hand-rolled obscuring policy.

4. **Optional, if you have time:** click the locale switcher in the header.
   Show the same species page in `/fr/`, `/de/`, or `/es/`. The narrative
   prose is still English placeholder until L5/L6, but the chrome and
   ecology labels are localized end-to-end.

**Punchline:** "If you remember nothing else about the public layer, remember
that the platform's job here is *zero misinformation* — every status badge
is auditable back to a human assessor or an IUCN sync row, and every
threatened-species coordinate is generalized."

---

## 2 · CARES keeper view — "give the hobbyists a seat at the table"

**Window B. ~3 minutes.**

This is the single most differentiating feature for the workshop audience.
Hobbyist breeders, CARES participants, and small private institutions have
historically been shut out of formal conservation tooling because every
existing system is gated to AZA-tier zoos. This platform inverts that.

1. Open `/account`. Show the institution affiliation block. The pending-claim
   queue is the gate — coordinators approve who is genuinely affiliated
   with which institution before any edit rights kick in. **Audit row is
   written on approval** (PR #190, Gate 13 R-arch-1) so we can reconstruct
   later who let whom into which institution and when.

2. Open `/dashboard/staff/populations`. Show:
   - The Tier 2 keeper sees **only their own institution's populations** —
     the queryset is institution-scoped at the permission layer, not the
     UI. A keeper from ABQ BioPark cannot read or guess at the populations
     held at, say, Aquarium of the Pacific, even by URL-poking.
   - Click into a population row. The edit form lets the keeper update:
     M.F.U counts, breeding status, husbandry notes, last-bred date.
     **They cannot change which institution the population belongs to** —
     that's a coordinator move only.
   - Submit a count change. Point out the success state and "last edited
     by you, just now" footer. This is the audit trail visible to the
     keeper themselves.

3. Open `/dashboard/staff/breeding-events`. Show the form. Walk through
   logging a breeding event:
   - Species, parent population, date, success / failure / unknown,
     fry count, husbandry notes.
   - The event becomes part of the institution's contribution record and
     feeds the per-species "bred this year at" aggregate on the
     coordinator dashboard.

4. Open `/dashboard/staff/field-programs` if there's a program with
   participating institutions to demo. Otherwise skip.

**Punchline:** "A CARES keeper feeding a 30-fish stocking record into this
form is contributing the same audited dataset as the AZA studbook keeper
two windows over. That's the network effect we don't have today, and it's
the reason a hobbyist-breeder population of *Paretroplus menarambo* matters
to the formal conservation community."

---

## 3 · Coordinator dashboard — "where the loop closes"

**Window C. ~4 minutes.**

This is the operational layer. It's behind a Tier 3+ gate; the public never
sees it. Tone shift: now we're showing how the platform *acts* on the
contributions from layer 2.

1. Land on `/dashboard/coordinator`. Walk the panel grid top-to-bottom:
   - **Aggregate context** — total ex-situ populations, species coverage,
     active programs, transfers in flight, transfers completed in last 30d.
     This is the "is the program healthy?" tile.
   - **IUCN sync status** — last run, next scheduled run, count of species
     with stale or missing assessments.
   - **Open breeding recommendations** — coordinator action items. Each
     row is a "breed", "hold", or "transfer" recommendation with a target
     species, target institutions, and a priority.
   - **Transfer activity** — proposed, approved, in-transit, recently
     completed moves. Each row has a deep-link **Edit →** column (PR #189)
     that drops you into the drafts editor with the matching card already
     open. No double-hop.
   - **Recent edits** — a 50-row tail of the audit log, scoped to the
     coordinator's view. Coordinator-overrides on a Tier 2 institution's
     data appear here with the coordinator's name, the institution they
     edited, and the diff.

2. Click **Edit →** on any in-flight transfer. Show how the page scrolls the
   matching card into view and opens it pre-expanded. Bump the status
   `proposed → approved`. Explain the audit row that just got written:
   actor=you, actor_institution=MFFCP Coordination, before/after diff,
   reason carried from the form.

3. Open `/dashboard/coordinator/breeding-recommendations`. Open a "breed"
   recommendation. Show:
   - The recommendation links a target species to one or more candidate
     institutions and a priority window.
   - Closing it requires linking back to a `BreedingEvent` row from layer 2
     — i.e., a CARES keeper or a zoo keeper has to actually log a breeding
     attempt before the coordinator can mark the rec done.
   - **This is the loop.** The platform doesn't just record; it routes.

4. **If audit governance is interesting to the room**, open
   `/dashboard/admin/audit/?action=update&target_type=accounts.User` and
   filter to the most recent claim-approval rows. Each row shows: which
   coordinator approved which user into which institution, when, with the
   actor's institution snapshotted at decision time. Useful for showing
   funders that "yes, we know who let everyone in".

**Punchline:** "The coordinator dashboard is the only place the network
effect becomes legible. A keeper logs a breeding event — the rec closes —
the species' captive demography updates — the funder report gets a real
number. None of those rows is editorializable; every one carries an
actor, an institution, and a diff."

---

## 4 · Audit + governance — "the part funders actually care about"

**Window C, optional. ~2 minutes.**

Run this if a funder or program officer is in the room. Skip if the
audience is mostly aquarists.

1. `/dashboard/admin/audit/` — the unfiltered audit log. Filter to the last
   24 hours. Show:
   - **Every row has an actor.** No anonymous writes; even system runs
     (IUCN sync, beat-scheduled exports) carry `actor_system="iucn_sync"`
     or similar.
   - **The log is append-only.** `AuditEntry.save()` refuses updates;
     `AuditEntry.delete()` raises. This is enforced at the model layer and
     defense-in-depth via DB permissions in production.
   - **Coordinator overrides are flagged.** When a Tier 3 coordinator edits
     a Tier 2 institution's data, the row records both the coordinator's
     identity AND the coordinator's institution at edit time, so a later
     reassignment can't obscure who did what.

2. **CSV export.** Click the export link, scope to the last 7 days. Open
   the CSV. Show that every row has a stable schema — funder reporters
   and IRB-style auditors can ingest this without bespoke parsing.

3. Mention but don't open: GBIF Darwin Core Archive export. That's the
   data-publication path; same audit invariants apply.

**Punchline:** "If a funder ever asks 'how do you know your data is
accurate?', the answer is: every row is reconstructible from this log,
forever. We didn't bolt audit on; the schema enforces it."

---

## 5 · Closing — what's next, and what's not

Two minutes, no slides. Just talk.

**Built and live as of the workshop:**

- Public species profiles + map (Tier 1).
- CARES keeper / Tier 2 self-service for populations + breeding events.
- Tier 3 coordinator dashboard, transfer drafting, breeding-rec routing.
- Append-only audit log + CSV export + GBIF DwC-A export.
- Multilingual chrome (en/fr; de/es placeholders).
- Auth, claim approval, role-based access tiers.

**Deferred post-conference:**

- ORCID auth (Gate 12). Email + password works fine for the workshop;
  ORCID adds friction for hobbyists and isn't load-bearing for any of
  the features above.
- L5/L6 — full FR/DE/ES content translation. The infrastructure ships
  now, the prose ships after a translator pass.
- Zoo-side studbook integration (ZIMS). We read; we don't write.

**What we're asking the room for:**

- **Pilot institutions.** Five aquariums and ten CARES breeders for the
  first six months would close the demand-side loop.
- **Field-program partners.** SHOAL is the obvious one. Coordinator
  conversation happening this week.
- **Domain editors.** The species narratives need primary-lit experts to
  vouch for or correct what's there. The audit log handles the rest.

**Punchline:** "The platform is shipped. What it needs now is people
inside it."

---

## Appendix · Live-demo failure recovery

If something breaks live, don't troubleshoot in front of the room. Skip
the affected segment, name what you'd have shown, and move on.

| Symptom | Likely cause | Workaround |
|---|---|---|
| Species page shows "Not yet assessed" on a known-CR species | IUCN sync hasn't run; mirror is empty | Move on; "the weekly job is the source — by next week this'll show CR" |
| Coordinator dashboard tile shows "—" for transfers in flight | API 5xx or no Tier-3 token | Refresh once; if still stuck, skip section 3.1 and demo from `/transfers/` directly |
| `/map` doesn't load tiles | Esri tile baking job stale | Skip the map demo; mention coordinate generalization on the species page instead |
| Locale switch shows raw keys (e.g., `dashboard.title`) | Catalog parity broken | Stay in English; mention the locale plumbing is wired and the catalogs are byte-identical placeholders |
| 500 on save in the keeper view | DB connection dropped | Skip section 2.2 edit; demo the read-only view and mention the edit path lives behind the same gate |

If the API is fully down (you can't load
<https://api.malagasyfishes.org/api/v1/schema/>): pull up the local
screenshots in `docs/demo/screenshots/` (TODO: add ahead of time) and
narrate over them. Don't try to bring the stack up live.
