import time

from django.core.management.base import BaseCommand, CommandError
from django.db import connections
from django.db.utils import OperationalError

PASSWORD_HINT = """
Postgres rejected the password for this user.

The most common cause: the Postgres data volume was initialised earlier with a
different POSTGRES_PASSWORD. Postgres only reads that variable the first time the
volume is created, so changing .env afterwards has no effect.

Fix it one of these ways:
  * Development (destroys local data):  docker compose down -v && docker compose up --build
  * Keep the data: docker compose exec db psql -U <user> -c "ALTER USER <user> PASSWORD '<new>';"
  * Or put the old password back in .env.

After editing .env, recreate the containers (docker compose up -d --force-recreate)
so they pick up the new values.
"""


class Command(BaseCommand):
    help = "Block until the default database accepts connections."

    def add_arguments(self, parser) -> None:  # type: ignore[no-untyped-def]
        parser.add_argument("--timeout", type=int, default=60, help="Seconds to wait before failing.")
        parser.add_argument("--interval", type=float, default=1.0, help="Seconds between attempts.")

    def handle(self, *args, timeout: int, interval: float, **options) -> None:  # type: ignore[no-untyped-def]
        self.stdout.write("Waiting for database...")
        deadline = time.monotonic() + timeout
        while True:
            try:
                connections["default"].ensure_connection()
            except OperationalError as exc:
                message = str(exc)
                if "password authentication failed" in message:
                    self.stderr.write(self.style.ERROR(message.strip()))
                    self.stderr.write(PASSWORD_HINT)
                    raise CommandError("Database password authentication failed.") from exc
                if time.monotonic() >= deadline:
                    raise CommandError(f"Database unavailable after {timeout}s: {message.strip()}") from exc
                time.sleep(interval)
            else:
                self.stdout.write(self.style.SUCCESS("Database available."))
                return
