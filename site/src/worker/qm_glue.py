# QUERYMIND site glue, run inside Pyodide. NOT part of the production
# backend and NOT a copy of scripts/verdict_glue.py (that file is read-only
# per the task brief). This only adds what the browser needs on top of the
# real, unmodified sql_validator.py / sql_validator_prefix_historical.py:
# a flat AST dump (for the Inspector/Console tree) and a judge() entrypoint.
# Gate classification itself stays in TypeScript (src/lib/gates.ts), ported
# by hand from scripts/verdict_glue.py, so there is exactly one source for
# the reason-prefix table and the worker only has to agree with it on gate
# *numbers*, never redefine them.
import sys
import sqlglot
from sqlglot import exp

_FORBIDDEN = (
    exp.Insert, exp.Update, exp.Delete, exp.Drop, exp.Alter,
    exp.Create, exp.TruncateTable, exp.Copy, exp.Attach, exp.Pragma,
    exp.Command, exp.Merge,
)


def _qm_ast(sql, dialect="postgres", cap=60):
    try:
        statements = sqlglot.parse(sql, read=dialect)
    except Exception as e:  # noqa: BLE001 - mirrors validate_sql's own catch
        return {"parsed": False, "error": str(e), "nodes": [], "statement_count": 0}
    statements = [s for s in statements if s is not None]
    if not statements:
        return {"parsed": False, "error": "no statements", "nodes": [], "statement_count": 0}

    nodes = []
    id_map = {}
    count = 0
    for stmt_idx, stmt in enumerate(statements):
        for node in stmt.walk():
            # Pinned sqlglot 30.21.0's walk() yields bare Expr nodes (not
            # the (node, parent, key) tuple older sqlglot releases used);
            # each node carries its own `.parent` reference instead, per
            # sqlglot/expressions/core.py.
            parent = node.parent
            if count >= cap:
                break
            nid = len(nodes)
            id_map[id(node)] = nid
            pid = id_map.get(id(parent)) if parent is not None else None
            label = None
            db = None
            if isinstance(node, exp.Table):
                label = node.name
                db = node.db or None
            elif isinstance(node, exp.Column):
                label = node.name
            elif isinstance(node, exp.Literal):
                label = str(node.this)
            else:
                nm = getattr(node, "name", None)
                if nm:
                    label = nm
            nodes.append({
                "id": nid,
                "parent_id": pid,
                "cls": type(node).__name__,
                "label": label,
                "db": db,
                "stmt": stmt_idx,
            })
            count += 1
    return {"parsed": True, "error": None, "nodes": nodes, "statement_count": len(statements)}


def qm_judge(sql, version):
    mod_name = "sql_validator" if version == "current" else "sql_validator_prefix_historical"
    mod = sys.modules[mod_name]
    result = mod.validate_sql(sql)
    ast_info = _qm_ast(sql)
    return {
        "ok": result.ok,
        "reason": result.reason,
        "referenced_views": result.referenced_views,
        "sql": result.sql,
        "ast": ast_info,
    }
