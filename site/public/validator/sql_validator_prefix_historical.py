"""HISTORICAL ARTIFACT - DO NOT USE IN PRODUCTION. This is a reconstruction of
sql_validator.py as it existed before the 2026-10-08 fix, for the live breach
replay on the QUERYMIND site only. It differs from the real, current,
production sql_validator.py in exactly one place: _is_unqualified() always
returns True, reproducing the bug where a CTE alias could shadow a
schema-qualified reference to a real Postgres catalog relation
(pg_catalog.pg_roles, information_schema.tables, pg_stat_activity) and bypass
the approved-views allowlist entirely. See artifacts/verification/
schema_qualified_cte_bypass_live_api.txt for the real, dated evidence this
was exploited against a live container before the fix, and sql_validator.py
(the real, current file) for the fix itself.

Everything below this notice is byte-for-byte identical to the pre-fix
source except that one function body - confirmed by a diff test in
scripts/verdict_glue.py.

SQL AST allowlist validator. Layer 1 of defense: parses the LLM's proposed
SQL with sqlglot (PostgreSQL dialect) and accepts it only if it is a single
SELECT or WITH...SELECT (CTE) statement that references only approved views,
calls only an explicit allowlist of functions, and contains no disallowed
construct anywhere in the tree (not just at the top level). Any parse
failure, any non-SELECT statement type, any reference to an unapproved
table, any disallowed function, and any multi-statement input is rejected
here, before the (also read-only, also least-privilege) database connection
ever sees it.

Default-deny, not denylist. On SQLite the function check was a DENYLIST of a
handful of named I/O functions; that is unsafe on Postgres, which has far
more dangerous functions than any denylist is likely to enumerate correctly
(pg_sleep, pg_read_file, dblink, lo_import, set_config, pg_terminate_backend,
...). ALLOWED_FUNC_TYPES below is an explicit allowlist of the sqlglot
*classes* the 5 approved views actually need; anything else - including
every "Anonymous" function sqlglot doesn't have a typed class for, which is
exactly where pg_sleep/set_config/dblink/etc. land - is rejected by default.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import sqlglot
from sqlglot import exp

from db.connection import APPROVED_VIEWS

DIALECT = "postgres"

# Allowlist by sqlglot node CLASS, not by name string - a schema-qualified
# call (pg_catalog.pg_sleep(1)) or a case-folding trick doesn't change the
# class sqlglot assigns, so this can't be bypassed the way a name-string
# denylist could be. Every class here was verified against a probe query
# (COUNT/SUM/AVG/MIN/MAX/ROUND/COALESCE/CAST/EXTRACT/DATE_TRUNC/CASE/UPPER/
# LOWER) to confirm this is the actual sqlglot class it parses to.
ALLOWED_FUNC_TYPES: tuple[type, ...] = (
    exp.Count,
    exp.Sum,
    exp.Avg,
    exp.Min,
    exp.Max,
    exp.Round,
    exp.Coalesce,
    exp.Cast,         # CAST(x AS ...) and the `::` shorthand
    exp.Extract,      # EXTRACT(year FROM ...)
    exp.TimestampTrunc,  # DATE_TRUNC('month', ...)
    exp.Case,
    exp.If,           # sqlglot sometimes folds CASE WHEN/ELSE into If
    exp.Upper,
    exp.Lower,
)

# Functions named explicitly in the remediation request. These are already
# rejected by the allowlist above (they all parse as exp.Anonymous, which is
# not in ALLOWED_FUNC_TYPES), named here only so a reviewer can see the
# property is actually tested, not just assumed. See
# tests/test_sql_validator.py::test_set_config_rejected etc.
_NAMED_DANGEROUS_FUNCTIONS = {"set_config", "pg_sleep", "pg_read_file", "dblink", "lo_import"}


@dataclass
class ValidationResult:
    ok: bool
    reason: str = ""
    referenced_views: list[str] = field(default_factory=list)
    sql: str = ""  # the AST-regenerated SQL actually to be executed


def validate_sql(sql: str) -> ValidationResult:
    if not sql or not sql.strip():
        return ValidationResult(False, "empty SQL")

    try:
        statements = sqlglot.parse(sql, read=DIALECT)
    except Exception as e:  # noqa: BLE001 - any parse failure is a rejection, not a crash
        return ValidationResult(False, f"SQL did not parse: {e}")

    statements = [s for s in statements if s is not None]
    if len(statements) != 1:
        return ValidationResult(False, f"expected exactly 1 statement, got {len(statements)} (multi-statement rejected)")

    stmt = statements[0]

    # Accept only SELECT, optionally wrapped in one or more CTEs (WITH ... SELECT).
    # Note: for `WITH x AS (...) SELECT ...`, sqlglot's top-level node is
    # already exp.Select (the with-clause lives in its `with_` arg), not
    # exp.With - this check exists for any dialect/version where that isn't
    # true, and is harmless either way.
    root = stmt
    if isinstance(root, exp.With):
        root = root.this
    if not isinstance(root, (exp.Select, exp.Union, exp.Subquery)):
        return ValidationResult(False, f"only SELECT/CTE statements are allowed, got {type(stmt).__name__}")

    # Defense in depth: explicitly reject any DDL/DML node anywhere in the
    # tree, even if sqlglot's top-level type check above were somehow
    # bypassed. This also catches `WITH d AS (DELETE FROM v_orders
    # RETURNING *) SELECT * FROM d` - the writable-CTE bypass - because the
    # Delete node is present in the tree regardless of which clause it's
    # nested under.
    forbidden_types = (
        exp.Insert, exp.Update, exp.Delete, exp.Drop, exp.Alter,
        exp.Create, exp.TruncateTable, exp.Copy, exp.Attach, exp.Pragma,
        exp.Command, exp.Merge,
    )
    for node in stmt.walk():
        if isinstance(node, forbidden_types):
            return ValidationResult(False, f"disallowed statement type in query: {type(node).__name__}")

    # SELECT ... INTO <table> silently creates a table - not a DDL/DML node
    # type, it's an attribute on the Select itself, so it needs its own
    # check. FOR UPDATE / FOR SHARE take row locks, which this read-only app
    # has no legitimate use for and which are also attributes, not nodes.
    for select_node in stmt.find_all(exp.Select):
        if select_node.args.get("into") is not None:
            return ValidationResult(False, "SELECT ... INTO is disallowed (creates a table)")
        if select_node.args.get("locks"):
            return ValidationResult(False, "FOR UPDATE/FOR SHARE is disallowed (takes a row lock)")

    # Reject any function call not on the explicit allowlist (default-deny).
    for node in stmt.walk():
        if isinstance(node, exp.Func) and not isinstance(node, ALLOWED_FUNC_TYPES):
            fname = node.name if isinstance(node, exp.Anonymous) else (node.sql_name() or type(node).__name__)
            return ValidationResult(False, f"disallowed function: {fname}")

    # Window functions (`COUNT(*) OVER (...)`) wrap an allowlisted aggregate
    # in an exp.Window node, which the function-class check above never
    # inspects - so it passed even though window functions were never meant
    # to be part of this surface. Same for the `||` concat operator
    # (exp.DPipe): it isn't a function call at all, so the allowlist above
    # never saw it either. Neither escapes the approved-views sandbox, but
    # both contradict the documented, intended surface (llm_sql.py's system
    # prompt, LIMITATIONS.md) - reject both explicitly to keep the actual
    # surface matching what's documented, in keeping with this module's
    # default-deny design.
    for node in stmt.walk():
        if isinstance(node, exp.Window):
            return ValidationResult(False, "window functions are not allowed")
        if isinstance(node, exp.DPipe):
            return ValidationResult(False, "the || concatenation operator is not allowed")

    # Only a single, TOP-LEVEL, non-recursive WITH clause is allowed. A
    # nested WITH (inside a subquery/derived table) or WITH RECURSIVE both
    # exist only to make the CTE-name-shadowing bypass below reachable in
    # more places than the simple case handles - reject them outright
    # rather than trying to validate every nesting shape.
    top_with = root.args.get("with_") if isinstance(root, (exp.Select, exp.Union)) else None
    all_with_nodes = list(stmt.find_all(exp.With))
    if any(w is not top_with for w in all_with_nodes):
        return ValidationResult(False, "nested WITH clauses are not allowed")
    if top_with is not None and top_with.args.get("recursive"):
        return ValidationResult(False, "WITH RECURSIVE is not allowed")

    # CTE-name-shadowing bypass: a CTE can be named after a real Postgres
    # catalog relation (pg_tables, pg_roles, pg_settings, ...) or even a
    # base table (customers). Postgres resolves a name against CTEs defined
    # so far, in order - a non-recursive CTE cannot see itself or any CTE
    # defined after it, so a reference to its own name (or a later CTE's
    # name) inside its own body resolves to the REAL relation, not the
    # alias. The validator has to resolve names the same way Postgres does,
    # or `WITH pg_tables AS (SELECT * FROM pg_tables) SELECT * FROM
    # pg_tables` would be accepted while actually reading pg_catalog.
    #
    # So: each CTE body is checked against only the CTE names defined
    # STRICTLY BEFORE it (plus the approved views); the main query (and any
    # non-CTE subquery) is checked against the approved views plus ALL CTE
    # names, since by the time the main query runs every CTE has been
    # defined.
    referenced: set[str] = set()
    defined_so_far: set[str] = set()
    cte_body_table_ids: set[int] = set()

    # A CTE name is NEVER schema-qualified in real Postgres - `pg_catalog.foo`
    # or `public.foo` always means the real relation, full stop, regardless
    # of whether a CTE happens to share the bare name `foo`. The earlier
    # version of this check compared only `table.name` and treated any
    # name collision as "it's the CTE", which meant `WITH pg_roles AS (...)
    # SELECT * FROM pg_catalog.pg_roles` was wrongly accepted as a reference
    # to the CTE and never checked against APPROVED_VIEWS - a live, confirmed
    # bypass letting an attacker read pg_catalog.pg_roles (incl. rolsuper),
    # information_schema.tables, and pg_stat_activity through this app. A
    # table reference may only be treated as a CTE match when it is BOTH
    # unqualified (no db/catalog) AND its bare name matches a locally-visible
    # CTE; any qualified reference is always checked against APPROVED_VIEWS,
    # with no exception for a name collision.
    def _is_unqualified(table: exp.Table) -> bool:
        # PRE-FIX BUG, reproduced on purpose: this ignored table.db/table.catalog
        # entirely, so ANY bare-name match to a CTE alias was treated as safe,
        # even when the reference was schema-qualified (pg_catalog.pg_roles).
        return True

    ctes = top_with.expressions if top_with is not None else []
    for cte in ctes:
        cte_name = cte.alias_or_name
        for table in cte.this.find_all(exp.Table):
            cte_body_table_ids.add(id(table))
            name = table.name
            if _is_unqualified(table) and name in defined_so_far:
                continue  # reference to an earlier CTE - fine
            if name not in APPROVED_VIEWS:
                return ValidationResult(False, f"unapproved table/view referenced: {name}")
            referenced.add(name)
        defined_so_far.add(cte_name)

    for table in stmt.find_all(exp.Table):
        if id(table) in cte_body_table_ids:
            continue  # already checked, order-aware, above
        name = table.name
        if _is_unqualified(table) and name in defined_so_far:
            continue  # reference to a CTE, valid anywhere in the main query
        referenced.add(name)
        if name not in APPROVED_VIEWS:
            return ValidationResult(False, f"unapproved table/view referenced: {name}")

    if not referenced:
        return ValidationResult(False, "query references no table (e.g. SELECT 1) - not useful here")

    # Execute exactly what was parsed and validated, not the original LLM
    # text: regenerating the SQL from the validated AST proves the string
    # the executor runs is provably the one this function judged, closing
    # the gap where the raw string could differ from the parsed/checked
    # tree (e.g. via a sqlglot quirk, encoding trick, or future parser bug).
    regenerated = stmt.sql(dialect=DIALECT)
    return ValidationResult(True, referenced_views=sorted(referenced), sql=regenerated)
