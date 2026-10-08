"""Validates, executes, and grounds a proposed SQL statement. No numbers in
the final narrative answer come from anywhere except the rows this module
actually fetched."""
from __future__ import annotations

import sqlite3
import time
from dataclasses import dataclass, field

from db.connection import get_readonly_connection
from sql_validator import validate_sql

ROW_CAP = 500
TIMEOUT_S = 5.0


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


def execute_validated_sql(sql: str) -> ExecutionResult:
    validation = validate_sql(sql)
    if not validation.ok:
        return ExecutionResult(ok=False, sql=sql, reason=f"rejected by SQL validator: {validation.reason}")

    conn = get_readonly_connection()
    conn.execute(f"PRAGMA busy_timeout = {int(TIMEOUT_S * 1000)}")
    start = time.monotonic()
    try:
        # Row cap enforced by wrapping, not by trusting the model's own LIMIT.
        capped_sql = f"SELECT * FROM ({sql.rstrip(';')}) AS _capped LIMIT {ROW_CAP + 1}"
        cursor = conn.execute(capped_sql)
        rows = cursor.fetchall()
        columns = [d[0] for d in cursor.description] if cursor.description else []
    except sqlite3.Error as e:
        conn.close()
        return ExecutionResult(ok=False, sql=sql, reason=f"execution error: {e}")
    elapsed = time.monotonic() - start
    conn.close()

    truncated = len(rows) > ROW_CAP
    rows = rows[:ROW_CAP]
    return ExecutionResult(
        ok=True,
        sql=sql,
        columns=columns,
        rows=[dict(r) for r in rows],
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
