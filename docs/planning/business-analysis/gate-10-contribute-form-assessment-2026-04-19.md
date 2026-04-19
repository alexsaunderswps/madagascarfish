# Gate 10 (Husbandry Contribute Form) — ECA Workshop Scope Assessment

**Date:** 2026-04-19
**Analyst:** Business Analyst Agent
**Related:** `docs/planning/specs/gate-10-husbandry-contribute-form.md`,
`docs/planning/specs/gate-09-husbandry-frontend.md`,
`docs/planning/business-analysis/species-profile-husbandry.md`,
`frontend/app/contribute/husbandry/page.tsx` (current stub),
`backend/husbandry/models.py`.

## Recommendation

**Descope Gate 10 from the ECA MVP. Keep the existing Gate 09 mailto
stub as the shipped contribute surface for June 1. Reopen Gate 10 as
the first post-workshop backlog item.**

The Gate 09 stub at `frontend/app/contribute/husbandry/page.tsx`
already renders a clean, species-aware mailto fallback with the correct
framing ("contribution form is not yet live"). That is a credible
workshop artifact. The Gate 10 spec itself flags the gate as
"nice-to-have, descope-able" and the sequencing note explicitly
endorses shipping Gate 09 with the mailto placeholder if schedule
pressure appears — and schedule pressure is real (domain cutover,
warm-cache extension, exemplar authoring all land in the same 6-week
window).

## Reasoning

**1. Audience at ABQ is institutional, not drive-by.** ECA attendees
are zoo curators, aquarium staff, SHOAL, Durrell, and researcher
peers. That audience does not self-serve a public web form to submit
husbandry knowledge; they email, corner Aleksei at a reception, or
exchange a business card. A live form does not change the workshop
conversation. The BA's prior §6 framing — "we have the frame, we are
inviting the community to fill it" — is delivered equally well by a
visible "Contribute updates" CTA that opens a mailto. The *frame* is
the demo artifact; the form is not.

**2. Inbound volume before June 1 is near-zero, and Aleksei is the
moderator of record anyway.** Every Gate 10 submission lands in
`HusbandryContribution` with `status='new'` and requires Aleksei to
manually triage and copy content into `SpeciesHusbandry`. Between now
and the workshop the realistic inbound is <10 submissions. Handling 10
emails beats standing up spam mitigation, rate-limiting, notification
email deliverability verification, and admin triage UI to handle the
same 10 submissions.

**3. Moderation and trust risk is real and asymmetric.** The platform
positions itself as a science-credibility surface (IUCN mirror policy,
sourced assessments, Darwin Core alignment). A public, unauthenticated
form is the first write surface on the site and the first place bad
data can land. The Gate 10 spec mitigates this correctly (records are
drafts, admin-gated before merge into `SpeciesHusbandry`) — but the
*perceived* risk at a funder pitch is higher than the real one.
Shipping it right before the workshop with no pre-workshop soak time
is the wrong order: test it in July when the only eyes on it are ours.

**4. Opportunity cost is specific.** The weeks before June 1 are
better spent on: (a) Aleksei's 3–5 exemplar husbandry records
(Q1 in the BA doc, still open), (b) the `malagasyfishes.org` DNS +
CSRF cutover blocking printed-handout URLs (`todo.md`), (c) warm-cache
coverage of husbandry URLs, (d) any visual polish to the Gate 09
teaser the workshop demo actually shows. None of those are
interchangeable with Gate 10 hours.

**5. The backend design in Gate 10 is sound and worth keeping as the
post-MVP first deliverable.** The `HusbandryContribution` model
(nullable `submitter_user`, `status`, `reviewer`, 90-day IP retention
note) is correctly designed to graduate into a Tier 2+ moderated
pipeline without migration pain. Descoping now costs nothing for the
long-term path; it only defers the write surface.

## Scope If Shipping Anyway

If schedule unexpectedly frees up and the PM wants to ship Gate 10
before June 1, the minimum viable slice is:

- Stories 10.1, 10.3, 10.5 only — public form, lands in Django model,
  honeypot + DRF throttle. Skip Story 10.6 (email notification) at MVP
  — admin polls `status='new'` manually for the pre-workshop trickle.
  Skip Story 10.2's pre-fill polish if it saves frontend hours. Story
  10.4 (forward-compatible model fields) is free since the model
  already specs them.
- Keep the Gate 09 mailto stub as the fallback on any error state
  (5xx, 429, network failure) rather than a generic error page — a
  form outage must not leave the contribute CTA dead at a workshop.
- Pre-workshop smoke test: one real submission from a non-dev machine
  into production, confirm it lands and no notification chain breaks
  silently.

Below that slice, Gate 10 is not worth shipping; the mailto stub is
better.

## Open Questions for the Product Manager

1. **Should Gate 10 be formally marked "deferred to post-MVP" in the
   spec header, or left as "Not started" with the descope rationale
   captured here?** Recommend the former — the spec status is read by
   future agents and ambiguity costs time.
2. **Does the Gate 09 stub need any copy tightening before the
   workshop?** Current stub says "not yet live" which is honest; a
   conservation-writer pass could frame it as an invitation ("email
   Aleksei directly to contribute — form launching post-workshop")
   rather than an absence. Low-effort, possibly high signal at the
   demo.
3. **What is the post-workshop sequencing?** If Gate 10 is first out
   of the gate in June, it should probably be paired with a small
   moderation-UI gate (admin list filters, one-click accept/reject)
   rather than shipped solo — otherwise Aleksei is hand-copying
   content out of admin into `SpeciesHusbandry` forever.
4. **Does descoping Gate 10 change the workshop narrative Aleksei
   wants to tell SHOAL?** Worth a 5-minute check before locking — the
   BA read is "no," but Aleksei owns the pitch.
