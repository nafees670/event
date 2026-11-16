# Kept for tooling that expects a WSGI entry point. Production runs config.asgi
# under Gunicorn + Uvicorn workers because WebSockets are required.
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

application = get_wsgi_application()
