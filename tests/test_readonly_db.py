"""Layer 2 of defense: the connection itself must refuse writes, independent
of the SQL validator. If the validator ever had a bug, this is the backstop.

Was a SQLite PRAGMA-query_only test; now exercises the real Postgres
read-only TRANSACTION mode (`set_session(readonly=True)` -> `SET TRANSACTION
READ ONLY` at the wire level) that db.connection.get_readonly_connection()
puts every connection into. Skips cleanly (not a failure) if the local
Postgres from `docker compose up -d` isn't reachable - see
tests/test_postgres_security.py for the broader role/grant/timeout proofs.
"""
import sys
from pathlib import Path

import psycopg2
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from db.connection import get_readonly_connection


def _postgres_reachable() -> bool:
    try:
        conn = get_readonly_connection()
        conn.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _postgres_reachable(),
    reason="Postgres not reachable on DATABASE_URL (run `docker compose up -d` first)",
)


def test_select_works():
    conn = get_readonly_connection()
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS n FROM v_customers")
        row = cur.fetchone()
    assert row["n"] > 0
    conn.rollback()
    conn.close()


def test_insert_rejected_by_readonly_transaction():
    # Postgres checks ACL (the role's own GRANTs) before transaction mode,
    # so querymind_reader - which also has no INSERT grant on the view - hits
    # InsufficientPrivilege first; tests/test_postgres_security.py's admin-role
    # test isolates the read-only-transaction layer on its own by using a
    # role that WOULD otherwise be allowed to write. Either error proves the
    # write didn't happen; both are exercised somewhere in this suite.
    conn = get_readonly_connection()
    with pytest.raises((psycopg2.errors.ReadOnlySqlTransaction, psycopg2.errors.InsufficientPrivilege)):
        with conn.cursor() as cur:
            cur.execute("INSERT INTO v_customers VALUES (99999, 'x', 'y', 'z', '2025-01-01')")
    conn.rollback()
    conn.close()


def test_delete_rejected_by_readonly_transaction():
    conn = get_readonly_connection()
    with pytest.raises((psycopg2.errors.ReadOnlySqlTransaction, psycopg2.errors.InsufficientPrivilege)):
        with conn.cursor() as cur:
            cur.execute("DELETE FROM v_customers")
    conn.rollback()
    conn.close()


def test_drop_rejected_by_readonly_transaction():
    conn = get_readonly_connection()
    with pytest.raises(psycopg2.Error):
        with conn.cursor() as cur:
            cur.execute("DROP TABLE customers")
    conn.rollback()
    conn.close()


def test_row_count_unchanged_after_rejected_writes():
    conn = get_readonly_connection()
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS n FROM v_customers")
        before = cur.fetchone()["n"]
    for bad_sql in ["INSERT INTO v_customers VALUES (1,2,3,4,5)", "DELETE FROM v_customers"]:
        try:
            with conn.cursor() as cur:
                cur.execute(bad_sql)
        except psycopg2.Error:
            conn.rollback()
    conn2 = get_readonly_connection()
    with conn2.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS n FROM v_customers")
        after = cur.fetchone()["n"]
    assert before == after
    conn.close()
    conn2.close()
