from typing import Any

from django.http import HttpRequest

from accounts.models import User


class EmailBackend:
    """Authenticate using email instead of username."""

    def authenticate(
        self, request: HttpRequest | None, email: str | None = None, password: str | None = None, **kwargs: Any
    ) -> User | None:
        if email is None or password is None:
            return None
        try:
            user = User.objects.get(email=email.lower().strip())
        except User.DoesNotExist:
            return None
        if not user.is_active:
            return None
        if user.check_password(password):
            return user
        return None

    def get_user(self, user_id: int) -> User | None:
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
