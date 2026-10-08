"""SQL AST allowlist validator. Layer 1 of defense: parses the LLM's proposed
SQL with sqlglot and accepts it only if it is a single SELECT or WITH...SELECT
(CTE) statement that references only approved views and no disallowed
constructs. Any parse failure, any non-SELECT statement type, any reference to
an unapproved table, and any multi-statement input is rejected here, before
the (also read-only) database connection ever sees it.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import sqlglot
from sqlglot import exp

from db.connection import APPROVED_VIEWS

DISALLOWED_FUNCTIONS = {"load_extension", "readfile", "writefile", "edit", "random"}


@dataclass
class ValidationResult:
    ok: bool
    reason: str = ""
    referenced_views: list[str] = field(default_factory=list)


def validate_sql(sql: str) -> ValidationResult:
    if not sql or not sql.strip():
        return ValidationResult(False, "empty SQL")

    try:
        statements = sqlglot.parse(sql, read="sqlite")
    except Exception as e:  # noqa: BLE001 - any parse failure is a rejection, not a crash
        return ValidationResult(False, f"SQL did not parse: {e}")

    statements = [s for s in statements if s is not None]
    if len(statements) != 1:
        return ValidationResult(False, f"expected exactly 1 statement, got {len(statements)} (multi-statement rejected)")

    stmt = statements[0]

    # Accept only SELECT, optionally wrapped in one or more CTEs (WITH ... SELECT).
    root = stmt
    if isinstance(root, exp.With):
        root = root.this
    if not isinstance(root, (exp.Select, exp.Union, exp.Subquery)):
        return ValidationResult(False, f"only SELECT/CTE statements are allowed, got {type(stmt).__name__}")

    # Defense in depth: explicitly reject any DDL/DML node anywhere in the tree,
    # even if sqlglot's top-level type check above were somehow bypassed.
    forbidden_types = (
        exp.Insert, exp.Update, exp.Delete, exp.Drop, exp.Alter,
        exp.Create, exp.TruncateTable, exp.Copy, exp.Attach, exp.Pragma,
        exp.Command, exp.Merge,
    )
    for node in stmt.walk():
        if isinstance(node, forbidden_types):
            return ValidationResult(False, f"disallowed statement type in query: {type(node).__name__}")

    # Reject disallowed/unsafe function calls (file I/O, extension loading).
    for node in stmt.walk():
        if isinstance(node, exp.Func):
            # sqlglot resolves known functions to typed classes with a
            # sql_name(); anything it doesn't recognize (including these
            # SQLite-specific I/O/extension functions) comes back as
            # Anonymous, whose real name is in `.this`, not sql_name().
            fname = (node.name if isinstance(node, exp.Anonymous) else node.sql_name()) or ""
            if fname.lower() in DISALLOWED_FUNCTIONS:
                return ValidationResult(False, f"disallowed function: {fname}")

    # CTE names (WITH x AS (...)) are local aliases, not database objects -
    # exclude them from the allowlist check, but still require every *base*
    # reference inside the CTE bodies themselves to be an approved view.
    cte_names = {cte.alias_or_name for cte in stmt.find_all(exp.CTE)}

    # Collect every table/view reference and reject anything not on the
    # approved-views allowlist (this blocks reading the underlying base
    # tables directly, and blocks sqlite_master / pragma-style introspection).
    referenced = set()
    for table in stmt.find_all(exp.Table):
        name = table.name
        if name in cte_names:
            continue
        referenced.add(name)
        if name not in APPROVED_VIEWS:
            return ValidationResult(False, f"unapproved table/view referenced: {name}")

    if not referenced:
        return ValidationResult(False, "query references no table (e.g. SELECT 1) - not useful here")

    return ValidationResult(True, referenced_views=sorted(referenced))
