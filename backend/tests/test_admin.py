import pytest

from accounts.models import User
from populations.models import ExSituPopulation, Institution
from species.models import Species


# --- Fixtures ---


@pytest.fixture
def admin_user(db: None) -> User:
    return User.objects.create_superuser(
        email="admin@example.com",
        password="securepass12345",
        name="Admin",
    )


@pytest.fixture
def tier3_staff(db: None) -> User:
    from django.contrib.auth.models import Permission
    from django.contrib.contenttypes.models import ContentType

    inst = Institution.objects.create(
        name="Cologne Zoo", institution_type="zoo", country="Germany"
    )
    user = User.objects.create_user(
        email="coordinator@example.com",
        password="securepass12345",
        name="Coordinator",
        is_active=True,
        is_staff=True,
        access_tier=3,
        institution=inst,
    )
    # Grant model-level permissions for ExSituPopulation admin access
    ct = ContentType.objects.get_for_model(ExSituPopulation)
    for codename in ("view_exsitupopulation", "change_exsitupopulation", "add_exsitupopulation"):
        perm = Permission.objects.get(content_type=ct, codename=codename)
        user.user_permissions.add(perm)
    # Refetch to clear Django's permission cache
    return User.objects.get(pk=user.pk)


@pytest.fixture
def other_institution(db: None) -> Institution:
    return Institution.objects.create(
        name="ABQ BioPark", institution_type="aquarium", country="United States"
    )


@pytest.fixture
def species(db: None) -> Species:
    return Species.objects.create(
        scientific_name="Bedotia geayi",
        family="Bedotiidae",
        genus="Bedotia",
    )


# --- Registration smoke tests ---


@pytest.mark.django_db
class TestAdminRegistration:
    """Every ModelAdmin is registered and its changelist loads without error."""

    ADMIN_MODELS = [
        ("species", "species"),
        ("species", "conservationassessment"),
        ("species", "taxon"),
        ("species", "specieslocality"),
        ("species", "watershed"),
        ("species", "protectedarea"),
        ("populations", "institution"),
        ("populations", "exsitupopulation"),
        ("accounts", "user"),
        ("accounts", "auditlog"),
        ("fieldwork", "fieldprogram"),
        ("integration", "syncjob"),
    ]

    @pytest.mark.parametrize("app,model", ADMIN_MODELS)
    def test_changelist_loads(self, admin_user: User, client: object, app: str, model: str) -> None:
        from django.test import Client

        c = Client()
        c.force_login(admin_user)
        url = f"/admin/{app}/{model}/"
        resp = c.get(url)
        assert resp.status_code == 200, f"Admin changelist {url} returned {resp.status_code}"


# --- Admin branding ---


@pytest.mark.django_db
class TestAdminBranding:
    def test_site_header(self, admin_user: User) -> None:
        from django.test import Client

        c = Client()
        c.force_login(admin_user)
        resp = c.get("/admin/")
        content = resp.content.decode()
        assert "Madagascar Freshwater Fish Conservation Platform" in content

    def test_site_title(self, admin_user: User) -> None:
        from django.contrib import admin

        assert admin.site.site_title == "MFFCP Admin"


# --- Institution-scoped write protection ---


@pytest.mark.django_db
class TestExSituInstitutionScoping:
    def test_tier3_can_edit_own_institution(
        self, tier3_staff: User, species: Species
    ) -> None:
        from django.test import Client

        pop = ExSituPopulation.objects.create(
            species=species,
            institution=tier3_staff.institution,
            breeding_status="unknown",
        )
        c = Client()
        c.force_login(tier3_staff)
        url = f"/admin/populations/exsitupopulation/{pop.pk}/change/"
        resp = c.get(url)
        assert resp.status_code == 200

    def test_tier3_cannot_see_other_institution_records(
        self, tier3_staff: User, other_institution: Institution, species: Species
    ) -> None:
        """get_queryset scoping hides other institutions' records entirely."""
        from django.test import Client

        pop = ExSituPopulation.objects.create(
            species=species,
            institution=other_institution,
            breeding_status="unknown",
        )
        c = Client()
        c.force_login(tier3_staff)
        # Direct URL to another institution's record — should 302 (not in queryset)
        url = f"/admin/populations/exsitupopulation/{pop.pk}/change/"
        resp = c.get(url)
        assert resp.status_code == 302

    def test_tier3_cannot_reassign_institution_on_own_record(
        self, tier3_staff: User, other_institution: Institution, species: Species
    ) -> None:
        """IDOR prevention: posting with a different institution_id is rejected."""
        from django.test import Client

        pop = ExSituPopulation.objects.create(
            species=species,
            institution=tier3_staff.institution,
            breeding_status="unknown",
        )
        c = Client()
        c.force_login(tier3_staff)
        url = f"/admin/populations/exsitupopulation/{pop.pk}/change/"
        resp = c.post(url, {
            "species": species.pk,
            "institution": other_institution.pk,
            "breeding_status": "breeding",
            "studbook_managed": False,
            "holding_records-TOTAL_FORMS": 0,
            "holding_records-INITIAL_FORMS": 0,
            "holding_records-MIN_NUM_FORMS": 0,
            "holding_records-MAX_NUM_FORMS": 1000,
        })
        # save_model checks target institution matches user's — should be 403
        assert resp.status_code == 403
        pop.refresh_from_db()
        assert pop.institution_id == tier3_staff.institution_id

    def test_admin_can_edit_any_institution(
        self, admin_user: User, other_institution: Institution, species: Species
    ) -> None:
        from django.test import Client

        pop = ExSituPopulation.objects.create(
            species=species,
            institution=other_institution,
            breeding_status="unknown",
        )
        c = Client()
        c.force_login(admin_user)
        url = f"/admin/populations/exsitupopulation/{pop.pk}/change/"
        resp = c.get(url)
        assert resp.status_code == 200


# --- SyncJob and AuditLog are read-only ---


@pytest.mark.django_db
class TestReadOnlyAdmins:
    def test_syncjob_no_add(self, admin_user: User) -> None:
        from django.test import Client

        c = Client()
        c.force_login(admin_user)
        resp = c.get("/admin/integration/syncjob/add/")
        assert resp.status_code == 403

    def test_auditlog_no_add(self, admin_user: User) -> None:
        from django.test import Client

        c = Client()
        c.force_login(admin_user)
        resp = c.get("/admin/accounts/auditlog/add/")
        assert resp.status_code == 403


# --- SpeciesLocality uses GIS admin ---


@pytest.mark.django_db
class TestSpeciesLocalityAdmin:
    def test_changelist_loads(self, admin_user: User) -> None:
        from django.test import Client

        c = Client()
        c.force_login(admin_user)
        resp = c.get("/admin/species/specieslocality/")
        assert resp.status_code == 200

    def test_add_form_loads(self, admin_user: User) -> None:
        from django.test import Client

        c = Client()
        c.force_login(admin_user)
        resp = c.get("/admin/species/specieslocality/add/")
        assert resp.status_code == 200


# --- User admin ---


@pytest.mark.django_db
class TestUserAdmin:
    def test_user_changelist_loads(self, admin_user: User) -> None:
        from django.test import Client

        c = Client()
        c.force_login(admin_user)
        resp = c.get("/admin/accounts/user/")
        assert resp.status_code == 200

    def test_user_add_form_loads(self, admin_user: User) -> None:
        from django.test import Client

        c = Client()
        c.force_login(admin_user)
        resp = c.get("/admin/accounts/user/add/")
        assert resp.status_code == 200

    def test_non_superuser_cannot_edit_privilege_fields(self, tier3_staff: User) -> None:
        """Tier 3-4 staff cannot escalate their own access_tier or is_staff."""
        from django.contrib.auth.models import Permission
        from django.contrib.contenttypes.models import ContentType
        from django.test import Client

        # Grant user admin permissions
        ct = ContentType.objects.get_for_model(User)
        for codename in ("view_user", "change_user"):
            perm = Permission.objects.get(content_type=ct, codename=codename)
            tier3_staff.user_permissions.add(perm)
        staff = User.objects.get(pk=tier3_staff.pk)

        c = Client()
        c.force_login(staff)
        url = f"/admin/accounts/user/{staff.pk}/change/"
        resp = c.get(url)
        assert resp.status_code == 200
        content = resp.content.decode()
        # access_tier should be rendered as read-only (not as an input field)
        assert 'name="access_tier"' not in content
