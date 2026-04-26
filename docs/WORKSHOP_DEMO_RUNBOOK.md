# ABQ ECA Workshop Demo Runbook

**Event:** ABQ BioPark Endangered Conservation Aquatic species (ECA) workshop
**Dates:** 2026-06-01 → 2026-06-05
**Audience:** SHOAL partnership conversation; AZA / EAZA coordinators; CARES network leads
**Demo driver:** Aleksei Saunders

Demo sequence, talking points, recovery paths. Read once at home, run
through twice, keep open on your phone during the talk.

---

## 0 · One-day-before checklist

Run this the morning of demo day, in this order, before you open the
laptop in front of anyone:

- [ ] **Data freshness.** SSH to staging:
      `ssh deploy@46.224.196.197 'cd /home/deploy/madagascarfish/deploy/staging && docker compose exec -T web python manage.py seed_demo_coordination'`
      (no `--clear` — this is a no-op on already-seeded demo rows). If
      you've added real CARES populations since the last run, the demo
      programs/recommendations/events still pin against your real data.
- [ ] **Public site.** Hit `https://malagasyfishes.org/` from a clean
      incognito window — the hero stat must show a non-zero number.
- [ ] **Coordinator dashboard.** Hit `/dashboard/coordinator` (logged
      out). All seven panels render. Panel 6 shows ≥ 3 open
      recommendations, mix of priorities. Panel 7 shows ≥ 3 events.
- [ ] **A flagship profile.** `/species/<menarambo-id>/` — silhouette
      renders, IUCN badge says CR, CARES + SHOAL chips both show.
- [ ] **Map.** `/map/` — Leaflet loads, generalized clusters appear,
      "Filtered to *X* · Clear" chip works.
- [ ] **Husbandry.** `/species/<menarambo-id>/husbandry/` — disclaimer
      visible, water ranges populated, CARES sourcing block at bottom.
- [ ] **Browser pre-warmed.** Hit each of the URLs above once so the
      Vercel ISR cache is warm. A cold demo on the first click is the
      worst time to hit the 1.5s SSR roundtrip.

Anything fails: jump to §6 (recovery).

---

## 1 · The story arc

The demo is **15 minutes worst-case, 8 minutes ideal**. The throughline:
> "Madagascar's freshwater fish are the most-imperiled vertebrate group
> on the island, and the ex-situ work is split across institutions and
> hobbyist keepers who don't share a registry. Here's a platform that
> integrates IUCN, CARES, SHOAL, and zoo studbook data in one place —
> public for awareness, restricted for coordination."

Three beats:

1. **Public surface (3 min)** — what a Tier 1 visitor sees.
2. **Coordinator surface (5 min)** — what a Tier 3+ partner sees,
   panel by panel.
3. **What's underneath (2 min)** — data sources, integrations, the
   "why we built this" framing.

Skip the third beat if you're tight on time. The coordinator dashboard
is the conversation centerpiece.

---

## 2 · Beat 1 — Public surface

**Open `https://malagasyfishes.org/`** (from a clean tab, ideally
incognito so the SHOAL audience sees the no-login experience).

**Talking points (in this order):**

1. *"Public surface. No login."*
2. Point at the **coverage-gap stat in the hero** — read the number
   out loud. *"X CR/EN/VU species, no captive population on record
   anywhere. That's why the platform exists."*
3. Click the stat → **species directory pre-filtered to those species**.
   *"Same data, drillable from the homepage. Default filter hides
   introduced species — toggle to include."*
4. Click into a flagship profile (suggest *Paretroplus menarambo*).
5. On the profile, point at:
   - The **IUCN badge** (CR) and the conservation summary panel.
   - The **CARES priority chip** and the **SHOAL priority chip** in
     the header. *"Both partner-network signals in the header. Not
     behind a click."*
   - The **distribution map thumbnail** — *"coordinates generalized
     for threatened species per GBIF guidance."*
   - The **husbandry teaser** with difficulty factors.
   - The **External References** card linking IUCN Red List + FishBase
     — *"we link to authoritative data, we don't duplicate it."*

**Don't open the husbandry page in this beat unless asked.** It's
deep; save it for follow-up Q&A.

---

## 3 · Beat 2 — Coordinator surface

**Open `/dashboard/coordinator`** in a new tab.

This is the conversation centerpiece. Walk the panels in order, but be
ready to skip ahead if a partner zooms in on one — that engagement is
the goal.

### Panel 1 — Coverage gap

*"Endemic, threatened, zero captive populations. Sorted by IUCN
severity. Endemic-only by default — toggle off if a partner asks
about non-endemic threatened fish."*

### Panel 2 — Studbook / coordinated breeding status

*"Three buckets: studbook-managed, breeding-but-not-studbook,
holdings-only. The middle bucket is the one nobody talks about — fish
bred at hobbyist scale, outside any formal program. Made visible."*

### Panel 3 — Sex-ratio / demographic risk

*"Per-population: M.F.U breakdown plus risk reasons — skew,
unsexed-fraction, undersized cohort. Coordinators triage from here."*

### Panel 4 — Stale census

*"Populations whose most recent census is over 12 months old. The
'who needs an update call' list."*

### Panel 5 — Transfer activity

*"Live transfer ledger. In-flight on top — proposed, approved,
in-transit. Completed in the last 90 days below. Permits, CITES
references, source and destination tracked per row."*

### Panel 6 — Open breeding recommendations

*"Coordinator to-do list. Critical and High at the top, overdue
tagged red. Modeled against the EAZA Population Management Manual
§3.14 breed/non-breed/transfer cut and the AZA SSP Handbook
Chapter 4 Breeding and Transfer Plan structure."*

### Panel 7 — Recent reproductive activity

*"Per-population event ledger. Last 90 days — spawning, hatching,
mortality, acquisition, disposition. Roll-up at the top, detail
table below."*

**Backup answer if someone asks about access tiers:** *"This page is
served via a server-side service token to a Tier 3+ audience.
Production-gated by `COORDINATOR_API_TOKEN` so an unauthenticated
browser can't reach the underlying API directly."*

---

## 4 · Beat 3 — What's underneath (skip if short on time)

**Open `/about/data/`** (or have it queued in another tab).

Talking points:

1. *"IUCN is source of truth. We mirror their assessments, never
   independently edit conservation status. There's a governance path
   for manual expert review when an assessment is contested."*
2. *"Darwin Core for occurrence records, GBIF-publishable. Coordinate
   generalization for threatened species follows GBIF's
   sensitive-species guidance."*
3. *"FishBase, CARES, SHOAL Madagascar priority list — integrated
   read-only, not duplicated."*
4. *"Open source, Apache 2.0. I'm hosting it today. Long-term
   governance is a SHOAL conversation — that's part of why I'm here."*

---

## 5 · Q&A talking points (have these queued mentally)

| If they ask… | Lead with… |
|---|---|
| "Can hobbyists submit data?" | Today: `/contribute/husbandry/` is a Django-backed contact form. Lands in admin, manually reviewed before anything goes public. Post-MVP: Tier 3+ moderated submission queue. |
| "How do you handle disagreement between IUCN and an expert?" | `ConservationStatusConflict` model, four-outcome resolution flow — accept IUCN, retain manual, reconcile, dismiss. Audit log on every state transition. Public badge always reflects the most-recent-accepted assessment. |
| "What about hybrids / undescribed morphospecies?" | Provisional name field plus `taxonomic_status` enum. Directory shows a "Provisional Name" pill. The profile is honest about description status. |
| "Who owns this?" | Me, today. Open source. Long-term governance TBD — designed to be hostable independently, there's an OPERATIONS.md runbook. |
| "GBIF / Darwin Core export?" | Schema is GBIF-shaped. The export pipeline — Darwin Core Archive plus IPT — is post-MVP, gate 08+. The coordinate-sensitivity work landing first is a precondition for safe publication. |
| "ZIMS integration?" | Read-only, via institutional data-sharing. We map ZIMS member IDs to our `Institution` rows. No write-back. |
| "Why not a Google Form / Airtable?" | Five-tier access, GIS-aware coordinate generalization, GBIF/Darwin Core compatibility. Hard to retrofit onto a generic tool. The tradeoff is real engineering — which is why the SHOAL conversation matters. |

---

## 6 · Recovery from in-demo failures

### Coordinator dashboard panels render empty

Most likely: `COORDINATOR_API_TOKEN` not set on Vercel, or token rotated
out of sync with staging backend.

**Recovery in front of audience:**
1. Don't apologize. Say *"the dashboard's running on a service token
   that I can show you another way."*
2. Open `https://api.malagasyfishes.org/api/v1/coordinator-dashboard/coverage-gap/`
   directly in a new tab — the API responds with the same payload that
   would feed Panel 1.
3. *"That's the same data; the dashboard just renders it. We can fix
   the token afterwards."*

**Recovery after demo:** OPERATIONS.md §11.2.

### Map page doesn't load

Most likely: Leaflet tiles blocked on the conference Wi-Fi, or the
`/api/v1/map/localities/` endpoint slow-cold.

**Recovery:**
1. Switch to map list view: `/map/?view=list`. Same data, no Leaflet
   network dependency. *"This is the accessible / keyboard-friendly
   view. Same locality records, no JavaScript map."*

### A specific profile 404s

Most likely: ID drift since you took the screenshot list.

**Recovery:**
1. Hit `/species/` and pick the first CR row. *"Let's look at this one
   instead."* — coordinator audiences won't notice or care which
   flagship you pick.

### Conference Wi-Fi dies entirely

Have the hero screenshot, the dashboard screenshot, and one full
profile screenshot saved to your phone's photo roll **before you
fly**. Walk through them on the phone if needed. Less polished but
the talk track stays intact.

---

## 7 · After-demo capture

Within 24h of each demo session, write down (in `docs/planning/ux-review/`
or as a fresh issue):

- Which panel each questioner zoomed in on. The signal is what they
  cared about, not what you said.
- Any feature requests, no matter how off-topic. They become the
  post-workshop backlog.
- Any data they offered to share. Get the email then; introductions
  go cold within a week.

---

## 8 · One-line failure-mode summary for your phone

**If everything else fails:**
1. Show `https://malagasyfishes.org/` and the coverage-gap stat.
2. Talk through the species → IUCN → CARES → SHOAL integration
   verbally.
3. Describe the coordinator panels by name without showing them.
4. Promise a follow-up email with screenshots.

That's a 60-second talk track that survives any infrastructure
failure short of "the laptop won't turn on."
