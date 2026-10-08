"""PRD-139b: a database outage/connection failure must come back as a clean
ExecutionResult, not an unhandled exception that would 500 out of api.py.
Deliberately points at a port nothing listens on - doesn't need
docker compose up. Uses pytest's monkeypatch so DATABASE_URL is restored
after this one test, never leaking into the other (live-DB) test modules
that run in the same pytest session."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from query_executor import execute_validated_sql


def test_db_connection_failure_is_a_clean_rejection_not_a_crash(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://nobody:nobody@127.0.0.1:1/querymind")
    result = execute_validated_sql("SELECT * FROM v_customers LIMIT 1")
    assert result.ok is False
    assert "connection" in result.reason.lower()


def test_unset_database_url_is_a_clean_rejection_not_a_crash(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    result = execute_validated_sql("SELECT * FROM v_customers LIMIT 1")
    assert result.ok is False
    assert "connection" in result.reason.lower()
