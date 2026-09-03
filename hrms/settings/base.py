"""
Base Django settings for the hrms project (migrated from saas-hrms-backend/Laravel
and saas-hrms-frontend/Next.js into a single Django application).
"""

from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
env_file = BASE_DIR / ".env"
if env_file.exists():
    environ.Env.read_env(str(env_file))

SECRET_KEY = env("DJANGO_SECRET_KEY", default="django-insecure-change-me-in-prod")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    # module apps, in dependency order
    "apps.core",
    "apps.accounts",
    "apps.access",
    "apps.organization",
    "apps.people",
    "apps.attendance",
    "apps.leave",
    "apps.payroll",
    "apps.recruitment",
    "apps.performance",
    "apps.onboarding",
    "apps.exit_mgmt",
    "apps.company_assets",
    "apps.communication",
    "apps.reports",
    "apps.ai_billing",
    "apps.platform_admin",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.core.middleware.TenantMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "hrms.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "apps.core.context_processors.nav_context",
            ],
        },
    },
]

WSGI_APPLICATION = "hrms.wsgi.application"

# ---------------------------------------------------------------------------
# Database - same MySQL "saad" DB the Laravel app used (docker-compose service
# "mysql", DB name "saad", per saas-hrms-backend/.env). Django models are
# written with explicit db_table = <laravel table name> so both apps could
# even coexist against the same schema during the migration window.
# ---------------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": env("DB_DATABASE", default="saad"),
        "USER": env("DB_USERNAME", default="root"),
        "PASSWORD": env("DB_PASSWORD", default="root"),
        "HOST": env("DB_HOST", default="127.0.0.1"),
        "PORT": env("DB_PORT", default="3306"),
        "OPTIONS": {"charset": "utf8mb4"},
    }
}

AUTH_USER_MODEL = "accounts.User"
AUTHENTICATION_BACKENDS = ["apps.accounts.backends.LaravelStyleBackend"]

# Laravel's users.password values are PHP bcrypt ($2y$...). This hasher lets
# the existing seeded/demo accounts keep working unchanged after cutover.
PASSWORD_HASHERS = [
    "apps.accounts.hashers.LaravelBcryptPasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = env("APP_TIMEZONE", default="UTC")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "apps.core.fields.UnsignedBigAutoField"

# ---------------------------------------------------------------------------
# Auth / sessions - Laravel used Sanctum bearer tokens read from
# localStorage by the separate React SPA. The unified Django app instead
# uses same-origin session + CSRF auth (see plan: architecture decisions).
# ---------------------------------------------------------------------------
LOGIN_URL = "accounts:login"
LOGIN_REDIRECT_URL = "core:home_redirect"
LOGOUT_REDIRECT_URL = "accounts:login"

SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_AGE = env.int("SESSION_LIFETIME_MINUTES", default=120) * 60

CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOW_CREDENTIALS = True

# ---------------------------------------------------------------------------
# REST framework - /api/v1/* stays byte-shape-compatible with the old
# Laravel {message, data} envelope (see apps/core/pagination.py, renderers.py).
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "EXCEPTION_HANDLER": "apps.core.exceptions.envelope_exception_handler",
    "UNAUTHENTICATED_USER": None,
}

# ---------------------------------------------------------------------------
# Email - mirrors Laravel's Mailpit-backed SMTP config for local dev.
# ---------------------------------------------------------------------------
EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = env("MAIL_HOST", default="127.0.0.1")
EMAIL_PORT = env.int("MAIL_PORT", default=1025)
EMAIL_HOST_USER = env("MAIL_USERNAME", default="")
EMAIL_HOST_PASSWORD = env("MAIL_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("MAIL_USE_TLS", default=False)
DEFAULT_FROM_EMAIL = env("MAIL_FROM_ADDRESS", default="hello@example.com")

# ---------------------------------------------------------------------------
# App-specific settings (mirrors Laravel .env / OtpService constants)
# ---------------------------------------------------------------------------
OTP_EXPIRES_MINUTES = 2
FRONTEND_BASE_URL = env("FRONTEND_BASE_URL", default="http://localhost:8000")

# auth.E003: email is intentionally NOT globally unique (unique per
# organization only, matching users_organization_id_email_unique) - Laravel's
# LoginController::login() itself does a global first-match lookup on email
# (see apps.accounts.services.authenticate_login), which is what this app
# replicates rather than "fixing" into a stricter uniqueness Laravel never had.
# urls.W005: 'payroll'/'people' are intentionally split across two include()
# calls each so their real (non-Django-app) URL prefixes match the original
# Next.js paths - see hrms/urls.py.
SILENCED_SYSTEM_CHECKS = ["auth.E003", "auth.W004", "urls.W005"]
