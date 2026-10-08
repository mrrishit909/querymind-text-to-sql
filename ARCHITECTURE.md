# Architecture

```
question (<=500 chars, Pydantic-validated, rate-limited via Redis if REDIS_URL is set)
        |
        v
llm_sql.generate_sql()
  system prompt = the 5 approved-view schema catalog + the validator's exact function
  allowlist, spelled out so the model doesn't reach for a function that will be rejected
  Claude (claude-sonnet-5-5) returns structured JSON: {sql, assumptions, referenced_views}
        |
        v
sql_validator.validate_sql(sql)          <-- LAYER 1: AST allowlist (PostgreSQL dialect)
  parse with sqlglot (read="postgres"); reject on parse failure
  reject anything that isn't exactly 1 statement (blocks "SELECT ...; DROP ...;")
  reject anything that isn't a SELECT or WITH...SELECT
  walk the full tree; reject any Insert/Update/Delete/Drop/Alter/Create/Truncate/
    Attach/Pragma/Command/Merge node anywhere, not just at the top level
  reject SELECT ... INTO (creates a table) and FOR UPDATE/FOR SHARE (row locks)
  reject any function call not on an explicit ALLOWLIST of sqlglot classes
    (Count/Sum/Avg/Min/Max/Round/Coalesce/Cast/Extract/TimestampTrunc/Case/If/Upper/Lower) -
    default-deny, so pg_sleep/pg_read_file/dblink/lo_import/set_config/anything
    unrecognized is rejected by construction, not by being named in a denylist
  reject any table/view reference not in {v_customers, v_products, v_orders,
    v_order_items, v_order_totals} (base tables are never exposed), resolving CTE
    names in definition order the same way Postgres does (a CTE body is checked
    against views + strictly earlier CTEs only, never itself or later ones, which is
    what makes `WITH pg_tables AS (SELECT * FROM pg_tables) ...` correctly resolve the
    inner reference to the real pg_catalog.pg_tables and get rejected)
  on success, returns the AST-REGENERATED sql (stmt.sql(dialect="postgres")), not the
    original LLM string - this is what gets executed, closing the gap where the raw
    text could differ from what was actually parsed and checked
        |
        v  (only if validated)
query_executor.execute_validated_sql(sql)
  LAYER 2: a real read-only Postgres TRANSACTION (`SET TRANSACTION READ ONLY` via
    psycopg2's set_session(readonly=True)) - independent of the role's own grants
  LAYER 3: the querymind_reader role's own grants (SELECT on the 5 views ONLY, zero
    grant on the 4 base tables) plus its role-level `statement_timeout = 3000` (3s) -
    a real database-enforced query EXECUTION timeout, not a lock-wait bound
  query wrapped in SELECT * FROM (<query>) LIMIT 501 so the row cap is enforced
    by the executor, not by trusting a LIMIT the model happened to write
  OperationalError (DB down) / RuntimeError (DATABASE_URL unset) / QueryCanceled
    (timeout fired) all return a clean rejected ExecutionResult, never an unhandled 500
        |
        v
query_executor.ground_narrative(question, result)
  builds the answer text ONLY from result.rows/result.columns; there is no
  code path where the LLM's own prose becomes the displayed numeric answer
        |
        v
api.py (FastAPI): POST /ask (blocking) and POST /ask/stream (SSE: generating_sql ->
  validating -> executing -> answer, or a terminal error event) share this pipeline
        |
        v
web/ (React chat UI: TanStack Query, Monaco-rendered SQL, Recharts chart alongside
  the result table, react-markdown+rehype-sanitize for the grounded answer, an SSE
  client for /ask/stream with a documented fallback to /ask)
```

## Design decisions

- **Three independent layers of defense, deliberately redundant**, not two. The AST
  validator (layer 1) is where almost all the adversarial test coverage lives (36 tests,
  including 6 regression tests for a real CTE-name-shadowing bug found and fixed during
  the Postgres migration), but `tests/test_postgres_security.py` and
  `tests/test_readonly_db.py` prove layers 2 and 3 independently block writes, enforce
  the timeout, and withstand even an *accidental* GRANT to the reader role (RLS still
  blocks it) - with the validator bypassed entirely in those tests. A bug in any one
  layer does not become a full compromise.
- **Definer-rights views owned by a dedicated RLS-governed role, not `security_invoker`.**
  The views are intentionally NOT created `WITH (security_invoker = true)`: that setting
  makes a view check the *querying* role's own base-table privileges, and
  `querymind_reader` deliberately has none - every query would then fail with "permission
  denied for table", including legitimate ones (reproduced live against a Postgres
  container before this design was chosen). Instead the 5 views are owned by
  `querymind_view_owner` - a separate, non-superuser, non-table-owner role with `SELECT`
  on the base tables and itself governed by Row-Level Security (`db/roles.sql`). This
  closes the actual risk `security_invoker` exists to prevent (a view silently
  inheriting a bypass-capable owner's privileges) without breaking the app, because
  `querymind_view_owner` has no bypass capability to inherit.
- **Views, not tables, are the entire vocabulary the LLM and validator know about.**
  `APPROVED_VIEWS` in `db/connection.py` is the single source of truth both the validator
  and the schema-catalog text read from.
- **The grounded answer is structurally incapable of inventing numbers.**
  `ground_narrative()` takes the already-executed `ExecutionResult` and only ever reads
  `result.rows`/`result.columns` - it does not receive or use any text the LLM wrote.
- **Row cap enforced by wrapping, not by instruction.** The role-level `statement_timeout`
  is what actually bounds runtime; the `LIMIT 501` wrapper is what bounds result size,
  independently of what the model's own query asked for.
- **Cost/latency logged per call.** `llm_sql.LLMResult` captures real token counts and USD
  cost per request; `recorded_examples.json` has actual measured costs from real calls
  made during the original build (total $0.0087 for 3 questions).
