from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403
from .base import DATABASES, SECRET_KEY, env_bool, env_int

if not SECRET_KEY:
    raise ImproperlyConfigured("SECRET_KEY must be set in production.")
if not DATABASES["default"]["PASSWORD"]:
    raise ImproperlyConfigured("POSTGRES_PASSWORD must be set in production.")

DEBUG = False

AUTH_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
SECURE_HSTS_SECONDS = env_int("SECURE_HSTS_SECONDS", 0)
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
