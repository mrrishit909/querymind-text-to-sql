"""Tests for the site-fixture generation helpers: gate classification stays
accurate against the real validator, and site/public/validator/ never
silently drifts from the real sql_validator.py."""
import hashlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from verdict_glue import classify_gate, run_both_validators

ROOT = Path(__file__).resolve().parent.parent


def test_gate_classification_matches_real_reasons():
    cases = [
        ("", 1),
        ("SELEKT * FROM FROM WHERE", 2),
        ("SELECT * FROM v_customers; DROP TABLE customers;", 3),
        ("DROP TABLE customers", 4),  # top-level statement type check, before the tree-walk gate
        ("WITH d AS (DELETE FROM v_orders RETURNING *) SELECT * FROM d", 5),  # DML nested inside a CTE
        ("SELECT * FROM v_orders FOR UPDATE", 6),
        ("SELECT pg_sleep(1)", 7),
        ("SELECT COUNT(*) OVER (PARTITION BY customer_id) FROM v_orders", 8),
        ("WITH RECURSIVE t AS (SELECT 1) SELECT * FROM t", 9),
        ("SELECT * FROM customers", 10),  # or 11, both share a prefix
    ]
    from sql_validator import validate_sql

    for sql, expected_gate in cases:
        r = validate_sql(sql)
        assert not r.ok, f"expected rejection for {sql!r}"
        gate = classify_gate(r.reason)
        assert gate is not None, f"no gate classified for reason: {r.reason!r}"
        if expected_gate in (10, 11):
            assert gate in (10, 11), f"{sql!r}: expected gate 10 or 11, got {gate}"
        else:
            assert gate == expected_gate, f"{sql!r}: expected gate {expected_gate}, got {gate} (reason: {r.reason!r})"


def test_prefix_historical_validator_reproduces_the_real_fixed_bypass():
    bypass_sql = "WITH pg_roles AS (SELECT 1 AS x FROM v_customers) SELECT rolname, rolsuper FROM pg_catalog.pg_roles"
    v = run_both_validators(bypass_sql)
    assert v.prefix_ok is True, "pre-fix validator must accept this (reproducing the real historical bug)"
    assert v.current_ok is False, "current validator must reject this (the real fix)"
    assert v.is_the_fixed_bypass is True


def test_legit_query_accepted_by_both_validators():
    v = run_both_validators("SELECT * FROM v_customers LIMIT 5")
    assert v.current_ok and v.prefix_ok


def test_site_public_validator_copy_is_byte_identical_to_source():
    src = ROOT / "sql_validator.py"
    copy = ROOT / "site" / "public" / "validator" / "sql_validator.py"
    assert copy.exists(), "run scripts/sync_validator_source.py first"
    src_hash = hashlib.sha256(src.read_bytes()).hexdigest()
    copy_hash = hashlib.sha256(copy.read_bytes()).hexdigest()
    assert src_hash == copy_hash, "site/public/validator/sql_validator.py has drifted from the real source - re-run scripts/sync_validator_source.py"
