"""Validates, executes, and grounds a proposed SQL statement. No numbers in
the final narrative answer come from anywhere except the rows this module
actually fetched.

Three independent layers protect every execution here:
  1. sql_validator.validate_sql() - AST allowlist (sql_validator.py)
  2. a read-only Postgres transaction (db.connection.get_readonly_connection,
     `SET TRANSACTION READ ONLY`) - independent of the role's own grants
  3. the querymind_reader role's own grants + its role-level
     `statement_timeout = 3000` (db/roles.sql) - a real database-enforced
     query execution timeout, not a lock-wait bound
"""
from __future__ import annotations

import datetime
import decimal
import time
from dataclasses import dataclass, field

import psycopg2
import psycopg2.errors

from db.connection import get_readonly_connection
from sql_validator import validate_sql

ROW_CAP = 500


@dataclass
class ExecutionResult:
    ok: bool
    sql: str
    reason: str = ""
    columns: list[str] = field(default_factory=list)
    rows: list[dict] = field(default_factory=list)
    row_count: int = 0
    truncated: bool = False
    elapsed_s: float = 0.0


def _jsonable(value):
    """psycopg2 returns Decimal for NUMERIC and date for DATE columns;
    neither is JSON-serializable by default (Pydantic would turn a Decimal
    into a string, silently changing the response shape). Normalize both to
    plain JSON types so /ask's response shape is unchanged from before the
    Postgres migration."""
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()
    return value


def execute_validated_sql(sql: str) -> ExecutionResult:
    validation = validate_sql(sql)
    if not validation.ok:
        return ExecutionResult(ok=False, sql=sql, reason=f"rejected by SQL validator: {validation.reason}")

    # Execute the AST-regenerated SQL (validation.sql), never the raw LLM
    # text - this is provably the exact query that was parsed and checked.
    validated_sql = validation.sql

    start = time.monotonic()
    try:
        conn = get_readonly_connection(readonly=True)
    except (psycopg2.OperationalError, RuntimeError) as e:
        # Service outage: Postgres unreachable/down (OperationalError), or
        # DATABASE_URL simply not configured (RuntimeError from
        # db.connection._dsn). Either way: a clean "I couldn't answer that
        # safely" ExecutionResult, not an unhandled 500 from api.py - this
        # is the PRD-139b connection-failure-handling gap.
        return ExecutionResult(ok=False, sql=validated_sql, reason=f"database connection failed: {e}")

    try:
        with conn.cursor() as cur:
            # Row cap enforced by wrapping, not by trusting the model's own
            # LIMIT. The role-level statement_timeout (3s, db/roles.sql) is
            # what actually bounds how long this can run.
            capped_sql = f"SELECT * FROM ({validated_sql}) AS _capped LIMIT {ROW_CAP + 1}"
            cur.execute(capped_sql)
            rows = cur.fetchall()
            columns = [d[0] for d in cur.description] if cur.description else []
    except psycopg2.errors.QueryCanceled:
        elapsed = time.monotonic() - start
        conn.rollback()
        conn.close()
        return ExecutionResult(ok=False, sql=validated_sql, reason=f"query exceeded the execution timeout after {elapsed:.1f}s")
    except psycopg2.Error as e:
        conn.rollback()
        conn.close()
        return ExecutionResult(ok=False, sql=validated_sql, reason=f"execution error: {e}")
    # Always roll back, even on success - this is a read-only transaction by
    # design (layer 2 above), there is nothing to commit, and a stray COMMIT
    # path is one more thing that could someday be made to persist a write
    # by accident.
    conn.rollback()
    conn.close()
    elapsed = time.monotonic() - start

    truncated = len(rows) > ROW_CAP
    rows = rows[:ROW_CAP]
    return ExecutionResult(
        ok=True,
        sql=validated_sql,
        columns=columns,
        rows=[{k: _jsonable(v) for k, v in dict(r).items()} for r in rows],
        row_count=len(rows),
        truncated=truncated,
        elapsed_s=elapsed,
    )


def ground_narrative(question: str, result: ExecutionResult) -> str:
    """Build the answer text strictly from result.rows - never from the LLM's
    own prose, so a fabricated number is structurally impossible here."""
    if not result.ok:
        return f"I couldn't answer that safely: {result.reason}"
    if result.row_count == 0:
        return "The query ran successfully and returned 0 rows."
    if result.row_count == 1 and len(result.columns) == 1:
        val = result.rows[0][result.columns[0]]
        return f"{result.columns[0]}: {val}"
    summary = f"Returned {result.row_count} row(s)"
    if result.truncated:
        summary += f" (capped at {ROW_CAP}; more rows exist)"
    summary += f" with columns {', '.join(result.columns)}."
    return summary
