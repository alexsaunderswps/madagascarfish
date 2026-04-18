from typing import Any

from django.contrib.auth.backends import ModelBackend
from django.http import HttpRequest

from accounts.models import User


class EmailBackend(ModelBackend):
    """Authenticate using email instead of username.

    Extends ModelBackend to inherit has_perm / has_module_perms so that
    Django Admin permission checks work for non-superuser staff.
    """

    def authenticate(
        self,
        request: HttpRequest | None,
        username: str | None = None,
        password: str | None = None,
        **kwargs: Any,
    ) -> User | None:
        # Django admin's AuthenticationForm always calls
        # authenticate(username=...) regardless of USERNAME_FIELD. Accept
        # `email` as a kwarg alias so direct callers (tests, shell) keep
        # working; prefer it when both are present.
        identifier = kwargs.get("email") or username
        if identifier is None or password is None:
            return None
        try:
            user = User.objects.get(email=identifier.lower().strip())
        except User.DoesNotExist:
            return None
        if not user.is_active:
            return None
        if user.check_password(password):
            return user
        return None
