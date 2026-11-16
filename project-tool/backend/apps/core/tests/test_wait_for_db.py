from unittest import mock

import pytest
from django.core.management import CommandError, call_command
from django.db.utils import OperationalError

TARGET = "apps.core.management.commands.wait_for_db.connections"


def test_returns_when_db_is_ready():
    with mock.patch(TARGET) as conns:
        call_command("wait_for_db", timeout=1)
    conns["default"].ensure_connection.assert_called_once()


def test_retries_until_db_is_ready():
    with mock.patch(TARGET) as conns, mock.patch("time.sleep"):
        conns["default"].ensure_connection.side_effect = [OperationalError("down"), OperationalError("down"), None]
        call_command("wait_for_db", timeout=30)
    assert conns["default"].ensure_connection.call_count == 3


def test_password_failure_prints_hint_and_stops(capsys):
    error = OperationalError('FATAL:  password authentication failed for user "pm_suite"')
    with mock.patch(TARGET) as conns, mock.patch("time.sleep") as sleep:
        conns["default"].ensure_connection.side_effect = error
        with pytest.raises(CommandError, match="password authentication failed"):
            call_command("wait_for_db", timeout=30)
    sleep.assert_not_called()
    assert "docker compose down -v" in capsys.readouterr().err
