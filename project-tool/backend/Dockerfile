FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

ARG INSTALL_DEV=false
COPY requirements.txt requirements-dev.txt ./
RUN if [ "$INSTALL_DEV" = "true" ]; then pip install -r requirements-dev.txt; else pip install -r requirements.txt; fi

RUN useradd --create-home --uid 1000 app \
    && mkdir -p /app/staticfiles /app/media /data/private \
    && chown -R app:app /app /data

COPY --chown=app:app . .
RUN chmod +x /app/docker/entrypoint.sh

USER app
EXPOSE 8000
ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["gunicorn", "config.asgi:application", "-k", "uvicorn_worker.UvicornWorker", "-b", "0.0.0.0:8000", "--workers", "3"]
