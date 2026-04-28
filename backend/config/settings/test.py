"""Test settings."""

from config.settings.base import *  # noqa: F401,F403

DEBUG = False

# Use in-memory cache for tests
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

# Faster password hashing in tests
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# Enable seed_test_users / get_verification_token in test runs and CI.
# Never set in prod settings.
ALLOW_TEST_HELPERS = True
