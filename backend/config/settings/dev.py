"""Development settings."""

from config.settings.base import *  # noqa: F401,F403

DEBUG = True

ALLOWED_HOSTS = ["*"]

# Refuse Species.iucn_status writes made outside an audit_actor context
# (see audit.signals.species_capture_pre_save). Off in prod.
AUDIT_STRICT_CONTEXT = True

# Add browsable API in dev
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = [  # noqa: F405
    "rest_framework.renderers.JSONRenderer",
    "rest_framework.renderers.BrowsableAPIRenderer",
]
