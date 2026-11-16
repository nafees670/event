"""Shared settings. Every deploy-specific value comes from the environment."""

import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    return int(value) if value not in (None, "") else default


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


SECRET_KEY = env("SECRET_KEY")
DEBUG = env_bool("DEBUG", False)
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "drf_spectacular",
    "corsheaders",
    "channels",
    "apps.core",
    "apps.accounts",
    "apps.organizations",
    "apps.spaces",
    "apps.projects",
    "apps.tasks",
    "apps.analytics",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", "pm_suite"),
        "USER": env("POSTGRES_USER", "pm_suite"),
        "PASSWORD": env("POSTGRES_PASSWORD"),
        "HOST": env("POSTGRES_HOST", "localhost"),
        "PORT": env("POSTGRES_PORT", "5432"),
        # Persistent connections do not play well with ASGI threads.
        "CONN_MAX_AGE": 0,
    }
}

REDIS_URL = env("REDIS_URL", "redis://localhost:6379/0")

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    }
}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}

AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = env("TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(env("MEDIA_ROOT", str(BASE_DIR / "media")))
# Project documents and attachments live here, outside MEDIA_ROOT, and are only
# served through permission-checked API endpoints.
PRIVATE_STORAGE_ROOT = Path(env("PRIVATE_STORAGE_ROOT", str(BASE_DIR / "private")))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- REST framework -------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["apps.accounts.authentication.CookieJWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
    "DEFAULT_THROTTLE_RATES": {
        "login": env("THROTTLE_LOGIN", "10/min"),
        "register": env("THROTTLE_REGISTER", "5/min"),
        "verify": env("THROTTLE_VERIFY", "10/min"),
        "password_reset": env("THROTTLE_PASSWORD_RESET", "5/min"),
    },
    # Requests arrive through Nginx, which appends the client address to X-Forwarded-For.
    "NUM_PROXIES": env_int("TRUSTED_PROXY_COUNT", 1),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "PM Suite API",
    "DESCRIPTION": "Project management and activity analytics platform.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_NAME_OVERRIDES": {
        "OrgRoleEnum": "apps.organizations.models.OrgRole",
        "SpaceRoleEnum": "apps.spaces.models.SpaceRole",
    },
}

# --- Auth / JWT cookies ---------------------------------------------------
SESSION_MAX_HOURS = env_int("SESSION_MAX_HOURS", 12)
ACCESS_TOKEN_MINUTES = env_int("ACCESS_TOKEN_MINUTES", 15)

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=ACCESS_TOKEN_MINUTES),
    "REFRESH_TOKEN_LIFETIME": timedelta(hours=SESSION_MAX_HOURS),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "SIGNING_KEY": env("JWT_SIGNING_KEY") or SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

AUTH_COOKIE_ACCESS = "pm_access"
AUTH_COOKIE_REFRESH = "pm_refresh"
# Non-secret marker read by the Next.js middleware to gate signed-in routes.
AUTH_COOKIE_SESSION = "pm_session"
AUTH_COOKIE_SECURE = env_bool("AUTH_COOKIE_SECURE", True)
AUTH_COOKIE_SAMESITE = env("AUTH_COOKIE_SAMESITE", "Lax")
AUTH_COOKIE_DOMAIN = env("AUTH_COOKIE_DOMAIN") or None

EMAIL_VERIFICATION_CODE_MINUTES = env_int("EMAIL_VERIFICATION_CODE_MINUTES", 15)
EMAIL_VERIFICATION_MAX_ATTEMPTS = env_int("EMAIL_VERIFICATION_MAX_ATTEMPTS", 5)
INVITATION_EXPIRY_HOURS = env_int("INVITATION_EXPIRY_HOURS", 72)
MAX_ATTACHMENT_MB = env_int("MAX_ATTACHMENT_MB", 25)
# Open tasks per person that count as a full workload (100% capacity) in analytics.
WORKLOAD_CAPACITY = env_int("WORKLOAD_CAPACITY", 8)
PASSWORD_RESET_TIMEOUT = env_int("PASSWORD_RESET_TIMEOUT_SECONDS", 3600)

FRONTEND_URL = env("FRONTEND_URL", "http://localhost").rstrip("/")

# --- CORS / CSRF ----------------------------------------------------------
# Nginx serves frontend and API on one origin, so CORS is only needed when the
# Next.js dev server runs on its own port.
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", "http://localhost")
CSRF_COOKIE_SECURE = AUTH_COOKIE_SECURE
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = AUTH_COOKIE_SECURE

# --- Email ----------------------------------------------------------------
EMAIL_BACKEND = env("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", "localhost")
EMAIL_PORT = env_int("EMAIL_PORT", 25)
EMAIL_HOST_USER = env("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", False)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "PM Suite <no-reply@pm-suite.local>")

# --- Celery ---------------------------------------------------------------
CELERY_BROKER_URL = env("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", REDIS_URL)
CELERY_TASK_ALWAYS_EAGER = env_bool("CELERY_TASK_ALWAYS_EAGER", False)
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULE: dict = {}

# --- Seed data guard (used by Phase 7 seed commands) ------------------------
ALLOW_SEED = env_bool("ALLOW_SEED", False)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"plain": {"format": "%(asctime)s %(levelname)s %(name)s: %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "plain"}},
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", "INFO")},
}
