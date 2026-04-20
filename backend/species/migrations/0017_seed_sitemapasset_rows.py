"""Pre-seed one row per SiteMapAsset slot.

Admins edit these rows rather than creating new ones — the slot enum is closed
at the code level (extending it requires a new migration), so the DB should
carry exactly the rows the frontend knows how to ask for. Empty ``image`` leaves
the public API returning 404, which the frontend reads as "render stripe
fallback". See docs/planning/registry-redesign/gate-1-visual-system.md (S14).
"""

from __future__ import annotations

from django.db import migrations


SEED_ROWS = [
    {
        "slot": "hero_thumb",
        "expected_width_px": 160,
        "expected_height_px": 320,
        "usage_notes": (
            "Home page hero — static Madagascar silhouette shown beside the "
            "Red List breakdown. Keep visual weight lighter than the headline."
        ),
    },
    {
        "slot": "profile_panel",
        "expected_width_px": 180,
        "expected_height_px": 360,
        "usage_notes": (
            "Species profile distribution panel — renders above the "
            "interactive MapClient. Emphasize the species' range, not the "
            "whole island."
        ),
    },
]


def seed(apps, schema_editor):
    SiteMapAsset = apps.get_model("species", "SiteMapAsset")
    for row in SEED_ROWS:
        SiteMapAsset.objects.get_or_create(slot=row["slot"], defaults=row)


def unseed(apps, schema_editor):
    SiteMapAsset = apps.get_model("species", "SiteMapAsset")
    SiteMapAsset.objects.filter(slot__in=[r["slot"] for r in SEED_ROWS]).delete()


class Migration(migrations.Migration):
    dependencies = [("species", "0016_add_sitemapasset")]

    operations = [migrations.RunPython(seed, unseed)]
