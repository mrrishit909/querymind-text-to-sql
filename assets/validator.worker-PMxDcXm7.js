(function(){let e=`/querymind-text-to-sql/`;function t(e){self.postMessage(e)}async function n(e){let t=await crypto.subtle.digest(`SHA-256`,new TextEncoder().encode(e));return Array.from(new Uint8Array(t)).map(e=>e.toString(16).padStart(2,`0`)).join(``)}async function r(e){let t=await fetch(e);if(!t.ok)throw Error(`fetch failed (${t.status}): ${e}`);return t.text()}let i=null,a=null,o=[],s=!1;async function c(){try{t({kind:`progress`,pct:5,stage:`loading pyodide runtime`});let{loadPyodide:o}=await import(
/* @vite-ignore */
`${e}pyodide/pyodide.mjs`);i=await o({indexURL:`${e}pyodide/`}),t({kind:`progress`,pct:35,stage:`fetching validator source`});let[s,c,u,d]=await Promise.all([r(`${e}validator/sql_validator.py`),r(`${e}validator/sql_validator_prefix_historical.py`),r(`${e}validator/connection_stub.py`),r(`${e}validator/validator_meta.json`)]),f=JSON.parse(d),[p,m]=await Promise.all([n(s),n(c)]),h={"sql_validator.py":{expected:f[`sql_validator.py`].sha256,actual:p,match:p===f[`sql_validator.py`].sha256},"sql_validator_prefix_historical.py":{expected:f[`sql_validator_prefix_historical.py`].sha256,actual:m,match:m===f[`sql_validator_prefix_historical.py`].sha256}};if(!h[`sql_validator.py`].match||!h[`sql_validator_prefix_historical.py`].match){t({kind:`error`,message:`validator source hash mismatch -- refusing to run an unverified file`});return}t({kind:`progress`,pct:45,stage:`importing sqlglot`}),await i.loadPackage(`micropip`);let g=new URL(`${e}pyodide/sqlglot-30.21.0-py3-none-any.whl`,self.location.origin).href;i.globals.set(`QM_WHEEL_URL`,g),await i.runPythonAsync(`
import micropip
await micropip.install(QM_WHEEL_URL, deps=False)  # deps=False: never resolves anything from PyPI
`),t({kind:`progress`,pct:70,stage:`installing the real validator`}),i.FS.mkdirTree(`/home/pyodide/db`),i.FS.writeFile(`/home/pyodide/db/__init__.py`,``),i.FS.writeFile(`/home/pyodide/db/connection.py`,u),i.FS.writeFile(`/home/pyodide/sql_validator.py`,s),i.FS.writeFile(`/home/pyodide/sql_validator_prefix_historical.py`,c),i.FS.writeFile(`/home/pyodide/qm_glue.py`,`# QUERYMIND site glue, run inside Pyodide. NOT part of the production
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
            # each node carries its own \`.parent\` reference instead, per
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
`),await i.runPythonAsync(`
import sys
if '/home/pyodide' not in sys.path:
    sys.path.insert(0, '/home/pyodide')
import importlib
import sql_validator
import sql_validator_prefix_historical
import qm_glue
import json

def qm_judge_json(sql, version):
    try:
        return json.dumps(qm_glue.qm_judge(sql, version))
    except Exception as e:  # noqa: BLE001 - never crash the worker on bad input
        return json.dumps({"ok": False, "reason": f"internal error: {e}", "referenced_views": [], "sql": "", "ast": {"parsed": False, "error": str(e), "nodes": [], "statement_count": 0}})
`),a=i.globals.get(`qm_judge_json`),t({kind:`progress`,pct:100,stage:`ready`}),t({kind:`ready`,sha:h}),l()}catch(e){t({kind:`error`,message:e instanceof Error?`${e.message}\n${e.stack??``}`:String(e)})}}function l(){if(s||!a)return;let e=o.shift();if(!e)return;s=!0;let n=performance.now(),r;try{let t=a(e.sql,e.version);r=JSON.parse(t)}catch(e){r={ok:!1,reason:`internal error: ${e instanceof Error?e.message:String(e)}`,referenced_views:[],sql:``,ast:{parsed:!1,error:String(e),nodes:[],statement_count:0}}}let i=performance.now()-n;t({kind:`result`,id:e.id,ok:!!r.ok,reason:r.reason??``,referencedViews:r.referenced_views??[],sql:r.sql??``,ast:r.ast,ms:i,version:e.version}),s=!1,l()}self.onmessage=e=>{let t=e.data;t?.kind===`judge`&&(o.length=0,o.push({id:t.id,sql:t.sql,version:t.version}),l())},c()})();