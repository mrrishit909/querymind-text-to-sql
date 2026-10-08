# QUERYMIND, Secure Text-to-SQL

Ask a plain-English question about a fictional commerce dataset. Claude proposes one SQL
statement from a narrow, approved-views schema catalog; `sqlglot` parses it and rejects
anything that is not a single read-only `SELECT`/CTE against an approved view; a read-only
SQLite connection executes what survives; the final answer is grounded only in the rows that
query actually returned.

Built as project 10 of a portfolio set adapted from an "audited Claude multi-agent" master-prompt
PDF. The prompt specified PostgreSQL with DB-role/RLS enforcement, pgvector, Redis, SSE
streaming, OpenTelemetry, and a 3-subagent build team. See [`LIMITATIONS.md`](LIMITATIONS.md)
for exactly what was substituted (mainly: SQLite instead of a Postgres server) and why.

## Security model (read this first)

Two independent layers, neither trusts the other:

1. **`sql_validator.py`** parses the LLM's proposed SQL into an AST (`sqlglot`) and accepts it
   only if it is a single `SELECT`/CTE statement referencing nothing but the 5 approved views,
   with no DDL/DML node anywhere in the tree and no disallowed functions (`load_extension`,
   `readfile`, `writefile`). It never trusts the LLM's own claim that a query is "safe", it
   judges structure, not stated intent, which is why a literal prompt-injection string embedded
   in a question is rejected the same way a hand-written `DROP TABLE` is.
2. **`db/connection.py`** opens SQLite itself in read-only mode (`mode=ro`) and additionally sets
   `PRAGMA query_only = ON`. Even if the validator had a bug, the connection physically cannot
   write.

Both layers have their own adversarial test suite (`tests/test_sql_validator.py`,
`tests/test_readonly_db.py`), 26 tests covering INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/ATTACH/
PRAGMA, multi-statement injection, base-table access, `sqlite_master` introspection, and unsafe
functions.

## Run it locally

Requires Python 3.12 (via `uv`), Node 22+, and your own Anthropic API key for the LLM layer
(everything else (the validator, the database, the 44 non-LLM-gated tests) runs with no key
and no network).

```bash
uv venv --python 3.12 venv
source venv/bin/activate
uv pip install -r requirements.txt
python db/seed.py                 # creates db/querymind.db (synthetic data, no PII)

# Tests that don't need a key or network (44 tests)
python -m pytest tests/ -v

# To also run the 2 real-LLM tests, export your key first:
export ANTHROPIC_API_KEY=sk-ant-...
python -m pytest tests/ -v         # 46 tests

# Start the API (needs ANTHROPIC_API_KEY in the environment for /ask)
uvicorn api:app --port 8010 --reload

# In a second terminal: the frontend
cd web && npm install && npm run dev
# open http://localhost:5180 (proxies /api/* to localhost:8010)
```

Without a key, `/execute` (direct validated SQL, no LLM) still works fully; `/ask` returns a
clear error instead of fabricating an answer.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness + whether an API key is configured |
| GET | `/schema` | the approved-views catalog shown to the LLM |
| POST | `/ask` | natural-language question -> LLM SQL -> validated -> executed -> grounded answer |
| POST | `/execute` | run already-written SQL through the same validate+execute pipeline, no LLM call |

`POST /ask` body: `{"question": "..."}` (1-500 chars). Empty, oversized, missing, or malformed
JSON all return 422.

## Repository layout

```
db/schema.sql       base tables + 5 approved read-only views (the only objects the LLM/validator know about)
db/seed.py           deterministic synthetic data generator (300 customers, 1200 orders)
db/connection.py     read-only connection + schema catalog text
sql_validator.py      the AST allowlist, the core security property of this app
llm_sql.py            the one Claude API call, structured JSON output, cost/latency logging
query_executor.py      validate -> execute -> ground the answer in actual rows
api.py                 FastAPI app
web/                   React + Vite + TypeScript + Tailwind chat UI
tests/                 46 tests: validator (19), read-only DB (5), API incl. negative-input gate (22)
recorded_examples.json real question->SQL->rows->answer examples with actual cost, for the static case study
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the data flow and [`LIMITATIONS.md`](LIMITATIONS.md)
for the threat model and what was substituted from the original spec.
