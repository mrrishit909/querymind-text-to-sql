"""DB-level security proofs against a LIVE docker-compose Postgres. These are
deliberately NOT unit tests of application code - every assertion here is a
raw psycopg2 connection doing something the app's code never does, to prove
the database itself (not just sql_validator.py) enforces the claim.

Skips the whole module cleanly (not a failure) if Postgres/DATABASE_URL/
ADMIN_DATABASE_URL aren't reachable, e.g. on a machine that hasn't run
`docker compose up -d` yet.
"""
import os
import sys
import time
from pathlib import Path

import psycopg2
import psycopg2.errors
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from db.connection import get_admin_connection, get_readonly_connection
from query_executor import execute_validated_sql


def _reachable() -> bool:
    try:
        conn = get_readonly_connection()
        conn.close()
        admin = get_admin_connection()
        admin.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _reachable(),
    reason="Postgres not reachable on DATABASE_URL/ADMIN_DATABASE_URL (run `docker compose up -d` first)",
)


def _reader_connection_no_readonly_flag():
    """A raw psycopg2 connection as querymind_reader, WITHOUT the app's
    read-only-transaction layer applied, so a failure here is attributable
    only to the role's GRANTs (task 5a/5b), not to the extra readonly
    transaction mode query_executor.py also applies."""
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    return conn


# --- 5(a): writes fail due to the role's grants, independent of the validator ---

@pytest.mark.parametrize(
    "sql",
    [
        "INSERT INTO customers (first_name, last_name, city, signup_date) VALUES ('x','y','z','2025-01-01')",
        "UPDATE customers SET city = 'nowhere'",
        "DELETE FROM customers",
        "DROP TABLE customers",
    ],
)
def test_writes_on_base_table_rejected_by_grants(sql):
    conn = _reader_connection_no_readonly_flag()
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        with conn.cursor() as cur:
            cur.execute(sql)
    conn.close()


# --- 5(b): a direct SELECT on the base table (bypassing the validator
# entirely) fails due to missing grants ---

def test_direct_select_on_base_table_rejected_by_grants():
    conn = _reader_connection_no_readonly_flag()
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM customers")
    conn.close()


def test_approved_view_still_readable_by_the_same_role():
    # Sanity check that the above failures are about base-table grants
    # specifically, not a broken role.
    conn = _reader_connection_no_readonly_flag()
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM v_customers")
        assert cur.fetchone()[0] > 0
    conn.close()


# --- RLS backstop: even an accidental base-table grant to the reader still
# yields zero rows, because no RLS policy names querymind_reader (db/roles.sql) ---

def test_rls_blocks_even_with_an_accidental_grant():
    admin = get_admin_connection()
    try:
        with admin.cursor() as cur:
            cur.execute("GRANT SELECT ON customers TO querymind_reader")
        admin.commit()

        conn = _reader_connection_no_readonly_flag()
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM customers")
            rows = cur.fetchall()
        conn.close()
        # The GRANT succeeds (table-level ACL check passes), but RLS has no
        # policy naming querymind_reader, so the row-visibility check below
        # ACL denies every row - this is the real value of enabling RLS on
        # these tables, proven, not asserted.
        assert rows == []
    finally:
        with admin.cursor() as cur:
            cur.execute("REVOKE SELECT ON customers FROM querymind_reader")
        admin.commit()
        admin.close()


# --- 5(c) / task 2: statement_timeout actually fires, at the database level ---

def test_statement_timeout_fires_bypassing_validator():
    """Raw reader connection, no validator, no query_executor - proves the
    3-second role-level statement_timeout (db/roles.sql) is a real Postgres
    control, not just a config value that exists on paper."""
    conn = _reader_connection_no_readonly_flag()
    start = time.monotonic()
    with pytest.raises(psycopg2.errors.QueryCanceled):
        with conn.cursor() as cur:
            cur.execute("SELECT pg_sleep(10)")
    elapsed = time.monotonic() - start
    conn.close()
    assert 2.0 < elapsed < 8.0, f"expected cancellation around 3s, took {elapsed:.1f}s"


def test_statement_timeout_fires_on_a_validator_accepted_slow_query():
    """A query the AST validator ACCEPTS (plain SELECT/COUNT over an
    approved view, no disallowed function or construct) but which is
    expensive enough to exceed 3 seconds: a triple self cross-join over
    v_order_items (~2960 rows, so ~2.6e10 output rows to compute). Runs
    through the real validate -> execute pipeline (query_executor.py), not
    a raw connection, so this proves the timeout fires for exactly the code
    path /ask and /execute actually use."""
    slow_sql = "SELECT COUNT(*) FROM v_order_items a, v_order_items b, v_order_items c"
    start = time.monotonic()
    result = execute_validated_sql(slow_sql)
    elapsed = time.monotonic() - start
    assert result.ok is False
    assert "timeout" in result.reason.lower() or "exceeded" in result.reason.lower()
    assert 2.0 < elapsed < 8.0, f"expected cancellation around 3s, took {elapsed:.1f}s"


# --- task 7: the read-only transaction layer blocks writes even for a role
# that would otherwise be allowed to write (independent of grants) ---

def test_read_only_transaction_blocks_write_even_for_the_admin_role():
    admin = get_admin_connection()
    admin.set_session(readonly=True, autocommit=False)
    with pytest.raises(psycopg2.errors.ReadOnlySqlTransaction):
        with admin.cursor() as cur:
            cur.execute("INSERT INTO customers (first_name, last_name, city, signup_date) "
                        "VALUES ('x','y','z','2025-01-01')")
    admin.rollback()
    admin.close()
