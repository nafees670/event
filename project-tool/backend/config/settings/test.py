import tempfile
from pathlib import Path

from .base import *  # noqa: F403
from .base import REST_FRAMEWORK, SIMPLE_JWT

SECRET_KEY = "test-secret-key-that-is-long-enough-for-hs256"
SIMPLE_JWT["SIGNING_KEY"] = SECRET_KEY
DEBUG = False

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
CELERY_TASK_ALWAYS_EAGER = True
CELERY_BROKER_URL = "memory://"
CELERY_RESULT_BACKEND = "cache+memory://"
AUTH_COOKIE_SECURE = True
FRONTEND_URL = "http://testserver"
REST_FRAMEWORK["NUM_PROXIES"] = 0
PRIVATE_STORAGE_ROOT = Path(tempfile.gettempdir()) / "pm-suite-test-private"
MAX_ATTACHMENT_MB = 1
