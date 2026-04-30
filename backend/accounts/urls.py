from django.urls import path

from accounts import views

app_name = "accounts"

urlpatterns = [
    path("register/", views.register, name="register"),
    path("verify/", views.verify_email, name="verify-email"),
    path("login/", views.login, name="login"),
    path("logout/", views.logout, name="logout"),
    path("me/", views.me, name="me"),
    path("me/locale/", views.update_locale, name="update-locale"),
    # Test helper — gated by settings.ALLOW_TEST_HELPERS, returns 404 in prod.
    path(
        "_test/verification-token/",
        views._test_verification_token,
        name="test-verification-token",
    ),
]
