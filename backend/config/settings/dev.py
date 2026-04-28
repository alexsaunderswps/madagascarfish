"""Development settings."""

from config.settings.base import *  # noqa: F401,F403

DEBUG = True

ALLOWED_HOSTS = ["*"]

# Local Next.js dev server
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Refuse Species.iucn_status writes made outside an audit_actor context
# (see audit.signals.species_capture_pre_save). Off in prod.
AUDIT_STRICT_CONTEXT = True

# Enable seed_test_users / get_verification_token in local dev — they're
# guarded server-side (DEBUG-style toggle). NEVER set in prod.
ALLOW_TEST_HELPERS = True

# Add browsable API in dev
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = [  # noqa: F405
    "rest_framework.renderers.JSONRenderer",
    "rest_framework.renderers.BrowsableAPIRenderer",
]
