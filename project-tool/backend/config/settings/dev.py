from .base import *  # noqa: F403
from .base import SECRET_KEY, SIMPLE_JWT, env_bool

DEBUG = env_bool("DEBUG", True)
SECRET_KEY = SECRET_KEY or "dev-only-insecure-secret-key-change-me"
SIMPLE_JWT["SIGNING_KEY"] = SIMPLE_JWT["SIGNING_KEY"] or SECRET_KEY
