# QUERYMIND, Secure Text-to-SQL

Ask a plain-English question about a fictional commerce dataset. Claude proposes one SQL
statement from a narrow, approved-views schema catalog; `sqlglot` parses it (PostgreSQL
dialect) and rejects anything that is not a single read-only `SELECT`/CTE against an approved
view, using an explicit function ALLOWLIST (not a denylist); a least-privilege PostgreSQL 17
role, in a read-only transaction, with a real 3-second statement-level timeout, executes what
survives; the final answer is grounded only in the rows that query actually returned.

Built as project 10 of a portfolio set adapted from an "audited Claude multi-agent" master-prompt
PDF, then hardened by an independent security review (see "Security model" below for what that
review found and how each gap was closed). See [`LIMITATIONS.md`](LIMITATIONS.md) for what is
still a documented substitution (mainly: no real cloud deployment, no Hypothesis/Vitest/
Playwright, no OpenTelemetry/Sentry/CI).

## Security model (read this first)

Three independent layers, none of which trusts the others:

1. **`sql_validator.py`** parses the LLM's proposed SQL into an AST (`sqlglot`, `read="postgres"`)
   and accepts it only if it is a single `SELECT`/CTE statement referencing nothing but the 5
   approved views, with no DDL/DML node anywhere in the tree (including inside a CTE - blocks
   `WITH d AS (DELETE ... RETURNING *) SELECT * FROM d`), no `SELECT ... INTO`, no
   `FOR UPDATE`/`FOR SHARE`, and no function call outside an explicit ALLOWLIST (`COUNT`, `SUM`,
   `AVG`, `MIN`, `MAX`, `ROUND`, `COALESCE`, `CAST`, `EXTRACT`, `DATE_TRUNC`, `CASE`, `UPPER`,
   `LOWER`) - everything else, including `pg_sleep`, `set_config`, `pg_read_file`, `dblink`,
   `lo_import`, is rejected by default, not by name-matching. The AST-regenerated SQL
   (`stmt.sql(dialect="postgres")`), not the original LLM text, is what `query_executor.py`
   actually executes, so the executed query is provably the one that was validated.
2. **A read-only PostgreSQL transaction** (`db/connection.py`, `set_session(readonly=True)` ->
   `SET TRANSACTION READ ONLY`) wraps every execution, independent of the role's own grants -
   proven by `tests/test_postgres_security.py::test_read_only_transaction_blocks_write_even_for_the_admin_role`,
   which uses the *admin* role (which could otherwise write) to show the transaction mode alone
   blocks it.
3. **`querymind_reader`**, a dedicated least-privilege PostgreSQL role (`db/roles.sql`): `GRANT
   SELECT` on the 5 approved views ONLY, no grant at all on the 4 base tables, and
   `ALTER ROLE querymind_reader SET statement_timeout = '3000'` - a real database-enforced
   query-execution timeout (not the `PRAGMA busy_timeout` bug from the SQLite build, which only
   bounded lock-wait time, never actual query runtime). Row-Level Security is enabled on the
   base tables as a default-deny backstop: the only role with an RLS policy is
   `querymind_view_owner` (a separate, non-superuser, non-table-owning role that owns the 5
   views), so even an *accidental* future `GRANT SELECT` on a base table straight to
   `querymind_reader` still returns zero rows - proven in
   `tests/test_postgres_security.py::test_rls_blocks_even_with_an_accidental_grant`.

**On `security_invoker = true`:** the remediation brief asked for every view to use
`WITH (security_invoker = true)`. That was tried first, against a live container, and found
incompatible with this app's model: an invoker-rights view checks the *querying* role's own
base-table privileges, and `querymind_reader` deliberately has none - so every single query,
including completely legitimate ones, would fail with `permission denied for table customers`
(SQLSTATE 42501). `db/schema.sql`'s header comment has the literal reproduction. The views here
use the documented pre-PG15 alternative instead: definer-rights views owned by a dedicated,
non-superuser, non-table-owner role that is itself governed by RLS - which closes the actual
risk `security_invoker` exists to close (a view silently inheriting a bypass-capable owner),
without breaking the no-base-grant reader model.

All three layers have adversarial test coverage: `tests/test_sql_validator.py` (36 tests, AST
layer, no DB needed - including the CTE-name-shadowing/forward-reference/WITH-RECURSIVE bypass
cases: a non-recursive CTE can't see its own name or a later CTE's name, so
`WITH pg_tables AS (SELECT * FROM pg_tables) ...` would otherwise resolve "pg_tables" to the real
catalog relation, not the alias - the validator now resolves CTE names in definition order, the
same way Postgres does), `tests/test_readonly_db.py` (5 tests, connection-level read-only
transaction), `tests/test_connection_failure.py` (2 tests, DB outage / unset `DATABASE_URL`
handling) and `tests/test_postgres_security.py` (10 tests, live-Postgres-only: role grants, RLS
backstop, and both the DB-level and validator-accepted-slow-query statement-timeout proofs). The
latter two skip cleanly (not fail) if `docker compose up -d` hasn't been run.

## Run it locally

Requires Python 3.12 (via `uv`), Node 22+, Docker (for Postgres 17 + Redis via Compose), and
your own Anthropic API key for the LLM layer. Everything else (the validator, the Postgres
security tests, the 67 non-LLM-gated tests) runs with no key.

```bash
# 1. Bring up Postgres 17 + Redis (db/schema.sql + db/roles.sql run automatically on first boot)
docker compose up -d --build

# 2. Python env
uv venv --python 3.12 venv
source venv/bin/activate
uv pip install -r requirements.txt
cp .env.example .env               # defaults already match docker-compose.yml's ports
set -a && source .env && set +a    # export DATABASE_URL / ADMIN_DATABASE_URL / REDIS_URL

python db/seed.py                  # seeds querymind (300 customers, 1200 orders) as the admin role
                                    # (docker-entrypoint-initdb.d only runs schema.sql/roles.sql on
                                    # first boot - it does NOT run seed.py; re-run this manually
                                    # any time you `docker compose down -v` and bring Postgres back
                                    # up on a fresh, empty volume)

# Tests that don't need an LLM key (75 tests: validator, Postgres security/RLS/timeout, rate
# limiter, API negative-input gate, connection-failure handling)
python -m pytest tests/ -v

# To also run the 2 real-LLM tests, export your OWN real key first (do not
# put a placeholder in .env - see .env.example's comment on ANTHROPIC_API_KEY):
export ANTHROPIC_API_KEY=sk-ant-...
python -m pytest tests/ -v         # 77 tests

# The dockerized API is already up on :8020 (docker compose up). For local hot-reload instead:
uvicorn api:app --port 8010 --reload

# In a second terminal: the frontend
cd web && npm install && npm run dev
# open http://localhost:5180 (proxies /api/* to the API port)
```

Without a key, `/execute` (direct validated SQL, no LLM) still works fully; `/ask` returns a
clear error instead of fabricating an answer. `docker compose down -v` tears everything down and
drops the Postgres volume; `docker compose up -d` on the resulting empty volume re-runs
`db/schema.sql` + `db/roles.sql` (the Postgres image's own first-boot behavior) but does **not**
re-seed data - run `python db/seed.py` again afterward.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness + whether an API key is configured |
| GET | `/schema` | the approved-views catalog shown to the LLM |
| POST | `/ask` | natural-language question -> LLM SQL -> validated -> executed -> grounded answer (rate-limited if `REDIS_URL` is set: 20 req/min per caller IP, no-op otherwise) |
| POST | `/ask/stream` | same pipeline as `/ask`, as staged Server-Sent Events - see `api.py::ask_stream`'s docstring for the exact event sequence/JSON shape |
| POST | `/execute` | run already-written SQL through the same validate+execute pipeline, no LLM call |

`POST /ask` body: `{"question": "..."}` (1-500 chars). Empty, oversized, missing, or malformed
JSON all return 422. A rate-limited request returns 429.

## Repository layout

```
db/schema.sql         base tables + 5 approved read-only views (Postgres 17 DDL)
db/roles.sql           querymind_view_owner / querymind_reader roles, grants, RLS policies, statement_timeout
db/seed.py             deterministic synthetic data generator (300 customers, 1200 orders), admin role
db/connection.py       reader/admin connections + schema catalog text
sql_validator.py       the AST allowlist (Postgres dialect, function allowlist), the core security property
llm_sql.py             the one Claude API call, structured JSON output, cost/latency logging
query_executor.py      validate -> execute (AST-regenerated SQL, read-only txn) -> ground the answer
api.py                 FastAPI app: /ask, /ask/stream (SSE), /execute, rate limiter
web/                   React + Vite + TypeScript + Tailwind chat UI
tests/                 77 tests: validator (36, incl. CTE-shadowing/WITH RECURSIVE bypass cases),
                        Postgres security/RLS/timeout (10, live-DB), read-only connection (5),
                        connection-failure handling (2), rate limiter (4), API incl. negative-input
                        gate (22, 2 LLM-gated)
docker-compose.yml      postgres:17 + redis:7 + the api image, local only, nothing deployed
recorded_examples.json real question->SQL->rows->answer examples with actual cost, for the static case study
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the data flow and [`LIMITATIONS.md`](LIMITATIONS.md)
for the threat model and what is still a documented substitution.
