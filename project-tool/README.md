# PM Suite

Multi-tenant project management and activity analytics platform.
Next.js 15 frontend, Django 5.1 + DRF + Channels backend, Celery and Celery Beat, PostgreSQL 16, Redis 7, Nginx.

> Status: **Phase 1** (infrastructure, auth, organizations, memberships, invitations, RBAC base).
> The full README (architecture diagram, env reference, troubleshooting, API overview) lands in Phase 7.

```
browser ──► nginx :80 ──┬─ /            ► frontend (Next.js :3000)
                        ├─ /api /admin  ► backend (Django ASGI :8000, Uvicorn)
                        ├─ /ws          ► backend (Channels, WebSocket upgrade)
                        └─ /media       ► backend
backend ─► postgres, redis      celery / celery-beat ─► redis (broker), postgres
```

## Run with Docker

```bash
cp .env.example .env            # optional: dev defaults work without it
docker compose up --build
```

Open http://localhost (or `http://localhost:$HTTP_PORT`). If ports 80 or 8000 are taken on your
machine, set `HTTP_PORT` / `BACKEND_PORT` in `.env`, and update `FRONTEND_URL` and
`CSRF_TRUSTED_ORIGINS` to match (e.g. `http://localhost:8088`). After editing `.env`, run
`docker compose up -d --force-recreate`.

**Emails** (verification codes, invites, password resets) are printed by the console backend in the
Celery logs: `docker compose logs -f celery`.

API docs: `/api/docs/` · Django admin: `/admin/` (`docker compose exec backend python manage.py createsuperuser`).

## Tests and checks

```bash
docker compose exec backend pytest          # backend tests (uses config.settings.test)
cd frontend && npx tsc --noEmit && npm run build
```

## Management commands

```bash
python manage.py wait_for_db [--timeout 60]
python manage.py set_membership --email a@b.c --org <slug|id> --role ADMIN|MEMBER|GUEST
python manage.py set_membership --email a@b.c --org <slug|id> --space DEV --role MANAGER|EMPLOYEE|GUEST
python manage.py set_membership --list [--email a@b.c] [--org <slug|id>]
```

## Production

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

`SECRET_KEY` and `POSTGRES_PASSWORD` are required: Compose and Django both refuse to start without them.
`SECURE_SSL_REDIRECT` defaults to on, so put TLS in front of Nginx (or set it to `False` for a plain-HTTP trial).

## Troubleshooting

- **`password authentication failed` on startup**: Postgres only reads `POSTGRES_PASSWORD` when its volume is
  first created. Either `docker compose down -v` (wipes data) or `ALTER USER` inside the db container.
  `wait_for_db` prints these steps.
- **`redis<7`**: the Python `redis` client is pinned below 7 because `channels_redis` doesn't support it yet.
  The Redis *server* is 7.
- **Signed out right away on Safari over http://localhost**: auth cookies are `Secure`. Chrome and Firefox
  accept them on localhost; Safari doesn't. Set `AUTH_COOKIE_SECURE=False` for local HTTP only.
