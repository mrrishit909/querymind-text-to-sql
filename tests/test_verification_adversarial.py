"""Independent adversarial coverage added by the verification-engineer pass,
NOT by sql-security-engineer. Ownership: this file only (new file; does not
edit test_sql_validator.py / test_postgres_security.py / any other existing
test file, per this subagent's scoped ownership).

These were found by directly attacking sql_validator.validate_sql() and the
live /execute endpoint, independently of every test the other two subagents
wrote and self-reported as passing. The schema-qualified-CTE-shadowing cases
below were originally marked xfail(strict=True) because they demonstrated a
REAL, then-currently-live bypass (verified through the real /execute
endpoint, returning actual pg_catalog.pg_roles rows including rolsuper
flags). The orchestrator fixed the underlying validator bug the same day
this was reported (sql_validator.py now checks `table.db`/`table.catalog`,
schema qualification, not just the bare name, before treating a reference as
a CTE match) and re-verified these same attacks are now rejected - so these
are now plain asserts, not xfail markers. The window-function and `||`
concat gaps were fixed the same way (sql_validator.py now explicitly rejects
exp.Window and exp.DPipe nodes).

See artifacts/verification/ for the full raw evidence of the ORIGINAL bypass
(direct psycopg2 attacks against querymind_reader, and curl transcripts
against the live /execute endpoint on a freshly
`docker compose down -v && up -d --build` stack, captured BEFORE the fix),
and REQUIREMENTS_AUDIT.md's "Independent Verification Pass" section and the
orchestrator's follow-up note for the narrative writeup of the fix.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from sql_validator import validate_sql


# ---------------------------------------------------------------------------
# CONFIRMED LIVE BYPASS: schema-qualified references around a same-named CTE.
#
# sql_validator.py's CTE-shadowing defense (the one PRD-137/REQUIREMENTS_AUDIT.md
# describes as "resolving CTE names in definition order, the same way Postgres
# does") compares bare `table.name` against the set of CTE names defined so
# far, and SKIPS the APPROVED_VIEWS check entirely on a match. It never looks
# at `table.db` (the schema qualifier). But a CTE name is NEVER
# schema-qualifiable in Postgres - `pg_catalog.pg_roles` can only ever mean
# the real catalog relation, regardless of whether a CTE named `pg_roles`
# exists in the same query. The validator's "same way Postgres does" claim is
# false for exactly this case: Postgres always disambiguates via the schema
# qualifier; the validator ignores it and treats the match as "safe, it's my
# own CTE alias".
#
# Verified live through the real /execute endpoint against a freshly
# `docker compose down -v && up -d --build` stack (not just at the unit
# level): pg_catalog.pg_roles (role list + rolsuper flags) and
# information_schema.tables (196-row full catalog enumeration) were both
# returned with safety_status "validated". See
# artifacts/verification/schema_qualified_cte_bypass_live_api.txt for the raw
# response bodies.
# ---------------------------------------------------------------------------
def test_schema_qualified_pg_roles_shadowed_by_cte_alias_should_be_rejected():
    r = validate_sql("WITH pg_roles AS (SELECT 1 AS x FROM v_customers) SELECT rolname FROM pg_catalog.pg_roles")
    assert not r.ok, "validator should not let a CTE alias shadow a schema-qualified catalog reference"


def test_schema_qualified_information_schema_shadowed_by_cte_alias_should_be_rejected():
    r = validate_sql("WITH tables AS (SELECT 1 AS x FROM v_customers) SELECT table_name FROM information_schema.tables")
    assert not r.ok


def test_schema_qualified_catalog_ref_in_a_later_cte_body_should_be_rejected():
    r = validate_sql(
        "WITH pg_roles AS (SELECT 1 AS x FROM v_customers), "
        "b AS (SELECT * FROM pg_catalog.pg_roles) SELECT * FROM b"
    )
    assert not r.ok


def test_schema_qualified_pg_stat_activity_shadowed_by_cte_alias_should_be_rejected():
    r = validate_sql(
        "WITH pg_stat_activity AS (SELECT 1 AS x FROM v_customers) "
        "SELECT usename, query, client_addr FROM pg_catalog.pg_stat_activity"
    )
    assert not r.ok


def test_control_schema_qualified_base_table_shadowed_by_cte_alias_is_now_rejected():
    """Control case that originally proved this was a validator-layer bug,
    not something the DB grants merely happened to paper over: before the
    fix, `public.customers` passed validate_sql() for the exact same reason
    as the pg_roles case above (the `customers` CTE alias shadowed it), and
    was only blocked at EXECUTION time by chance (querymind_reader has no
    grant on `customers`) - a backstop that would NOT have saved
    `pg_roles`/`information_schema.tables`, which are publicly world-readable
    by default in Postgres. Now that `table.db`/`table.catalog` are checked,
    the validator itself rejects this, matching the pg_roles/
    information_schema cases above rather than relying on grants to get
    lucky. See artifacts/verification/schema_qualified_cte_bypass_live_api.txt
    for the original (pre-fix) evidence.
    """
    r = validate_sql("WITH customers AS (SELECT * FROM v_customers) SELECT * FROM public.customers")
    assert not r.ok


# ---------------------------------------------------------------------------
# Lower-severity discrepancies: documented-as-unavailable SQL constructs that
# the validator in fact accepts and that DO execute live against Postgres.
# Neither of these escapes the approved-views sandbox or reaches data not
# already fully readable via a plain SELECT on the same view - so these are
# spec/documentation mismatches, not privilege-escalation bypasses. Reported
# because task 2(d) explicitly asked for exactly this category of finding.
# ---------------------------------------------------------------------------
def test_window_function_over_allowed_aggregate_should_be_rejected_per_docs():
    r = validate_sql("SELECT customer_id, COUNT(*) OVER (PARTITION BY customer_id) FROM v_orders")
    assert not r.ok


def test_concat_operator_should_be_rejected_per_docs():
    r = validate_sql("SELECT first_name || last_name FROM v_customers")
    assert not r.ok


# ---------------------------------------------------------------------------
# Things that were tried and are confirmed NOT to be a bypass - kept as
# regression tests since they were genuinely adversarial attempts, not
# re-runs of the other agents' own cases.
# ---------------------------------------------------------------------------
def test_row_number_and_rank_window_functions_are_rejected():
    # Unlike COUNT/SUM OVER(...) above, ROW_NUMBER()/RANK() are bare
    # exp.Anonymous functions with no allowlisted inner class to hide behind,
    # so they ARE correctly rejected.
    assert not validate_sql("SELECT ROW_NUMBER() OVER (ORDER BY order_date) FROM v_orders").ok
    assert not validate_sql("SELECT RANK() OVER (ORDER BY order_date) FROM v_orders").ok


def test_copy_to_stdout_as_a_subquery_is_rejected():
    assert not validate_sql("COPY (SELECT * FROM v_customers) TO STDOUT").ok


def test_array_agg_and_string_agg_are_rejected():
    assert not validate_sql("SELECT ARRAY_AGG(order_id) FROM v_orders").ok
    assert not validate_sql("SELECT STRING_AGG(status, ',') FROM v_orders").ok


def test_json_build_object_and_to_json_are_rejected():
    assert not validate_sql("SELECT JSON_BUILD_OBJECT('id', customer_id) FROM v_customers").ok
    assert not validate_sql("SELECT TO_JSON(c) FROM v_customers c").ok


def test_bare_set_statement_is_rejected_so_timeout_override_is_unreachable_via_the_app():
    # A raw querymind_reader connection CAN trivially override its own
    # session statement_timeout (`SET statement_timeout = 0`) - any ordinary
    # Postgres role can do this for its own session, it needs no special
    # privilege. Confirmed live: see
    # artifacts/verification/timeout_override_attempt.txt (a 4s pg_sleep
    # completed uncancelled after `SET statement_timeout = 0` on a bare
    # psycopg2 connection). This is NOT reachable through the app, because
    # validate_sql() rejects any bare SET/RESET statement outright (it isn't
    # a SELECT/CTE) before a connection ever executes attacker-controlled
    # SQL. This test pins that the app-level backstop for this specific gap
    # is "SET statements never reach the DB", not "the role can't do this" -
    # if that top-level SELECT/CTE check is ever loosened, this specific
    # protection silently disappears.
    assert not validate_sql("SET statement_timeout = 0").ok
    assert not validate_sql("RESET statement_timeout").ok
