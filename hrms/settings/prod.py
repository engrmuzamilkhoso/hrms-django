"""
Production settings. Point DJANGO_SETTINGS_MODULE at this module (not
hrms.settings.dev, which force-opens ALLOWED_HOSTS and downgrades email to
console-only) for any real deployment.

Everything host-specific (ALLOWED_HOSTS, CSRF_TRUSTED_ORIGINS, DB, mail)
still comes from base.py's env() calls / the server's .env - this file only
adds the security hardening a live HTTPS deployment needs on top of that.
"""

from .base import *  # noqa: F401,F403

DEBUG = False

# Django's CSRF check validates the Origin header against this list for any
# unsafe (POST/PUT/PATCH/DELETE) HTTPS request - e.g. login. Must include the
# scheme. Comma-separated in .env, e.g.:
#   CSRF_TRUSTED_ORIGINS=https://hrms.toollzen.com,https://www.hrms.toollzen.com
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

# Shared hosting (cPanel/Passenger, nginx, etc.) terminates TLS in front of
# the app and proxies plain HTTP to it - without this, Django sees every
# request as HTTP and SECURE_SSL_REDIRECT/secure cookies would loop or break.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Standard hardening defaults for an HTTPS deployment.
SECURE_HSTS_SECONDS = env.int("DJANGO_HSTS_SECONDS", default=31536000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

CORS_ALLOW_ALL_ORIGINS = False
