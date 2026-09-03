from .base import *  # noqa: F401,F403

DEBUG = True
ALLOWED_HOSTS = ["*"]

# Local dev default: no SMTP server required unless MAIL_HOST is set in .env
if env("MAIL_HOST", default="") == "":
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
