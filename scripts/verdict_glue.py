"""Shared helpers for generating QUERYMIND's static site fixtures: classifying
which real gate in sql_validator.py produced a given verdict, and running the
SAME query through both the current validator and the reconstructed pre-fix
historical validator for the breach replay.

GATES below is a description of the REAL, CURRENT sql_validator.py in source
order - written by reading that file, not injected into it (the production
validator stays byte-for-byte unmodified; this is read-only documentation of
its behavior, auto-checked against real reason strings by
test_gate_classification_matches_real_reasons in tests/test_verdict_glue.py).
"""
from __future__ import annotations

import importlib.util
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sql_validator import validate_sql as validate_sql_current  # noqa: E402

GATES = [
    {"id": 1, "title": "Empty input", "reason_prefix": "empty SQL"},
    {"id": 2, "title": "Must parse as SQL", "reason_prefix": "SQL did not parse"},
    {"id": 3, "title": "Exactly one statement", "reason_prefix": "expected exactly 1 statement"},
    {"id": 4, "title": "Must be SELECT or CTE", "reason_prefix": "only SELECT/CTE statements are allowed"},
    {"id": 5, "title": "No DDL/DML anywhere in the tree", "reason_prefix": "disallowed statement type in query"},
    {"id": 6, "title": "No SELECT INTO / FOR UPDATE / FOR SHARE", "reason_prefix": ("SELECT ... INTO", "FOR UPDATE/FOR SHARE")},
    {"id": 7, "title": "Function allowlist (default-deny)", "reason_prefix": "disallowed function"},
    {"id": 8, "title": "No window functions / no || operator", "reason_prefix": ("window functions are not allowed", "concatenation operator is not allowed")},
    {"id": 9, "title": "No nested WITH / WITH RECURSIVE", "reason_prefix": ("nested WITH clauses", "WITH RECURSIVE")},
    {"id": 10, "title": "CTE bodies may only reference approved views or earlier CTEs", "reason_prefix": "unapproved table/view referenced"},
    {"id": 11, "title": "Main query may only reference approved views or any CTE", "reason_prefix": "unapproved table/view referenced"},
]


def classify_gate(reason: str) -> int | None:
    """Best-effort mapping from a real reason string to the gate that produced
    it. Gates 10/11 share a reason prefix (both are the same check applied to
    two different scopes of the tree) and can't be distinguished from the
    string alone - callers that need to distinguish them should inspect
    whether the match came from inside a CTE body."""
    for gate in GATES:
        prefixes = gate["reason_prefix"]
        if isinstance(prefixes, str):
            prefixes = (prefixes,)
        if any(reason.startswith(p) for p in prefixes):
            return gate["id"]
    return None


_prefix_module = None


def _load_prefix_validator():
    global _prefix_module
    if _prefix_module is not None:
        return _prefix_module
    path = ROOT / "sql_validator_prefix_historical.py"
    spec = importlib.util.spec_from_file_location("sql_validator_prefix_historical", path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["sql_validator_prefix_historical"] = mod
    spec.loader.exec_module(mod)
    _prefix_module = mod
    return mod


@dataclass
class DualVerdict:
    sql: str
    current_ok: bool
    current_reason: str
    current_gate: int | None
    prefix_ok: bool
    prefix_reason: str
    prefix_gate: int | None
    is_the_fixed_bypass: bool  # True iff pre-fix accepted AND current rejects


def run_both_validators(sql: str) -> DualVerdict:
    cur = validate_sql_current(sql)
    pre = _load_prefix_validator().validate_sql(sql)
    return DualVerdict(
        sql=sql,
        current_ok=cur.ok,
        current_reason=cur.reason,
        current_gate=classify_gate(cur.reason) if not cur.ok else None,
        prefix_ok=pre.ok,
        prefix_reason=pre.reason,
        prefix_gate=classify_gate(pre.reason) if not pre.ok else None,
        is_the_fixed_bypass=(pre.ok and not cur.ok),
    )
