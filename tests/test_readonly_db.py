"""Second layer of defense: the DB connection itself must refuse writes,
independent of the SQL validator. If the validator ever had a bug, this is
the backstop."""
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from db.connection import get_readonly_connection


def test_select_works():
    conn = get_readonly_connection()
    rows = conn.execute("SELECT COUNT(*) AS n FROM v_customers").fetchall()
    assert rows[0]["n"] > 0
    conn.close()


def test_insert_rejected_at_connection_level():
    conn = get_readonly_connection()
    with pytest.raises(sqlite3.OperationalError):
        conn.execute("INSERT INTO v_customers VALUES (99999, 'x', 'y', 'z', '2025-01-01')")
    conn.close()


def test_delete_rejected_at_connection_level():
    conn = get_readonly_connection()
    with pytest.raises(sqlite3.OperationalError):
        conn.execute("DELETE FROM v_customers")
    conn.close()


def test_drop_rejected_at_connection_level():
    conn = get_readonly_connection()
    with pytest.raises(sqlite3.OperationalError):
        conn.execute("DROP TABLE customers")
    conn.close()


def test_row_count_unchanged_after_rejected_writes():
    conn = get_readonly_connection()
    before = conn.execute("SELECT COUNT(*) AS n FROM v_customers").fetchone()["n"]
    for bad_sql in ["INSERT INTO v_customers VALUES (1,2,3,4,5)", "DELETE FROM v_customers"]:
        try:
            conn.execute(bad_sql)
        except sqlite3.OperationalError:
            pass
    after = conn.execute("SELECT COUNT(*) AS n FROM v_customers").fetchone()["n"]
    assert before == after
    conn.close()
