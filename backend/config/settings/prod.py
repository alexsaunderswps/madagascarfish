"""Production settings."""

from config.settings.base import *  # noqa: F401,F403
from config.settings.base import env

DEBUG = False

ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")

# Caddy terminates TLS in front of gunicorn and forwards with X-Forwarded-Proto;
# without this, Django sees http://, marks the admin POST as insecure-origin,
# and rejects the CSRF token even though the user is browsing over https.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Django 4+ requires scheme-qualified origins. Derived from DJANGO_ALLOWED_HOSTS
# so staging and future hosts don't need a second env var to stay in sync.
CSRF_TRUSTED_ORIGINS = env.list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    default=[f"https://{h}" for h in ALLOWED_HOSTS if h and not h.startswith(".")],
)

SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
