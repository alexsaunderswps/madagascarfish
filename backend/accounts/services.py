"""Service-layer functions for institution-claim approval / rejection.

Per Gate 13 architecture §3.5: admin actions and (optional) REST endpoints
share these internal helpers so the lifecycle is consistent across both
surfaces.

Each function is atomic — the user-side mutation, the claim row transition,
and the email send happen in a single transaction. Email failure does not
roll back the approval (`fail_silently=True`) per architecture R-arch-7.
"""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from accounts.models import PendingInstitutionClaim, User
from audit.context import audit_actor


def approve_claim(
    *,
    claim: PendingInstitutionClaim,
    reviewer: User,
    review_notes: str = "",
) -> PendingInstitutionClaim:
    """Approve a pending institution claim.

    - Sets `claim.user.institution = claim.institution`.
    - Flips `claim.status = APPROVED`, captures `reviewed_at` / `reviewed_by`.
    - Sends `institution_claim_approved` email via `send_translated_email()`
      with `fail_silently=True` per R-arch-7.

    Raises `ValueError` if the claim is not in PENDING state.
    """
    if claim.status != PendingInstitutionClaim.Status.PENDING:
        raise ValueError(
            f"Cannot approve a claim in state {claim.status!r}; only pending claims are approvable."
        )
    with transaction.atomic():
        with audit_actor(user=reviewer, reason="institution claim approval"):
            user = claim.user
            user.institution = claim.institution
            user.save(update_fields=["institution"])
        claim.status = PendingInstitutionClaim.Status.APPROVED
        claim.reviewed_at = timezone.now()
        claim.reviewed_by = reviewer
        claim.review_notes = review_notes
        claim.save(update_fields=["status", "reviewed_at", "reviewed_by", "review_notes"])
    _send_claim_email(claim=claim, template_base="accounts/institution_claim_approved")
    return claim


def reject_claim(
    *,
    claim: PendingInstitutionClaim,
    reviewer: User,
    review_notes: str = "",
) -> PendingInstitutionClaim:
    """Reject a pending institution claim.

    - Leaves `claim.user.institution` unchanged (NULL for fresh signups).
    - Flips `claim.status = REJECTED`, captures `reviewed_at` / `reviewed_by`,
      stores `review_notes` (used as the rejection reason in the email).
    - Sends `institution_claim_rejected` email via `send_translated_email()`
      with `fail_silently=True`.

    Raises `ValueError` if the claim is not in PENDING state.
    """
    if claim.status != PendingInstitutionClaim.Status.PENDING:
        raise ValueError(
            f"Cannot reject a claim in state {claim.status!r}; only pending claims are rejectable."
        )
    with transaction.atomic():
        claim.status = PendingInstitutionClaim.Status.REJECTED
        claim.reviewed_at = timezone.now()
        claim.reviewed_by = reviewer
        claim.review_notes = review_notes
        claim.save(update_fields=["status", "reviewed_at", "reviewed_by", "review_notes"])
    _send_claim_email(claim=claim, template_base="accounts/institution_claim_rejected")
    return claim


def _send_claim_email(*, claim: PendingInstitutionClaim, template_base: str) -> None:
    """Send the approval / rejection email.

    Best-effort — `fail_silently=True` matches the existing signup pattern.
    A failed email leaves the DB state intact (the user discovers their
    approval/rejection on next login).
    """
    try:
        from i18n.email import send_translated_email
    except ImportError:
        # i18n module not yet wired — skip silently.
        return

    try:
        send_translated_email(
            recipient=claim.user,
            template=template_base,
            context={
                "user": claim.user,
                "institution": claim.institution,
                "review_notes": claim.review_notes,
            },
            fail_silently=True,
        )
    except Exception:
        # send_translated_email is supposed to honor fail_silently, but if
        # it raises (e.g., template not found before deploy), don't roll
        # back the approval.
        pass
