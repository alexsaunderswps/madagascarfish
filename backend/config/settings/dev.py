"""Development settings."""

from config.settings.base import *  # noqa: F401,F403

DEBUG = True

ALLOWED_HOSTS = ["*"]

# Add browsable API in dev
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = [  # type: ignore[name-defined]  # noqa: F405
    "rest_framework.renderers.JSONRenderer",
    "rest_framework.renderers.BrowsableAPIRenderer",
]
