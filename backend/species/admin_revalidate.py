"""Manual cache-bust admin action (FE-07-11).

Posts the canonical set of public page paths to the Next.js
/api/revalidate route with a shared secret. Exposed as a Django admin action
so Aleksei can click "Revalidate public pages" from any relevant admin list
view and have CARES/IUCN updates surface on the public site without waiting
for the 3600s ISR window.
"""

from __future__ import annotations

from typing import Any

import requests
from django.conf import settings
from django.contrib import admin, messages
from django.db.models import QuerySet
from django.http import HttpRequest
from django.utils.translation import gettext_lazy as _

# Canonical public paths served by Next.js. Wildcards (e.g. /species/[id])
# are revalidated by their dynamic parent; Next.js revalidatePath handles the
# tag/path matching. Keep this list tight — it's what the admin action fires.
PUBLIC_PATHS: list[str] = [
    "/",
    "/dashboard",
    "/species",
    "/species/[id]",
    "/map",
    "/about",
]


def _post_revalidate() -> tuple[bool, str]:
    url = getattr(settings, "NEXT_REVALIDATE_URL", "")
    secret = getattr(settings, "NEXT_REVALIDATE_SECRET", "")
    timeout = getattr(settings, "NEXT_REVALIDATE_TIMEOUT_SECONDS", 10)

    if not url or not secret:
        return False, str(
            _(
                "Revalidate is not configured: set NEXT_REVALIDATE_URL and "
                "NEXT_REVALIDATE_SECRET in the environment."
            )
        )

    try:
        response = requests.post(
            url,
            json={"paths": PUBLIC_PATHS},
            headers={"X-Revalidate-Secret": secret},
            timeout=timeout,
        )
    except requests.Timeout:
        return False, str(
            _("Revalidate timed out after %(t)ss — check frontend health.") % {"t": timeout}
        )
    except requests.RequestException as exc:
        return False, str(_("Revalidate request failed: %(e)s") % {"e": exc})

    if response.status_code >= 400:
        return False, str(
            _("Revalidate returned HTTP %(code)s: %(body)s")
            % {"code": response.status_code, "body": response.text[:200]}
        )

    try:
        data = response.json()
    except ValueError:
        return True, str(
            _("Revalidate succeeded (HTTP %(code)s, non-JSON body).")
            % {"code": response.status_code}
        )

    revalidated = data.get("revalidated") or []
    failures = data.get("failures") or []
    summary = str(_("Revalidated %(n)s path(s).") % {"n": len(revalidated)})
    if failures:
        summary += " " + str(
            _("%(n)s path(s) failed: %(list)s") % {"n": len(failures), "list": failures}
        )
    return True, summary


@admin.action(description=_("Revalidate public pages (clear Next.js cache)"))
def revalidate_public_pages(
    modeladmin: admin.ModelAdmin[Any],
    request: HttpRequest,
    queryset: QuerySet[Any],
) -> None:
    """Fire the revalidate webhook and report the result in the admin UI.

    The queryset is ignored — revalidation is global across the canonical
    public paths. The action is attached to multiple admin classes so that
    curators can trigger it from wherever they just finished editing.
    """
    del queryset  # intentionally unused
    ok, msg = _post_revalidate()
    level = messages.SUCCESS if ok else messages.ERROR
    modeladmin.message_user(request, msg, level=level)
