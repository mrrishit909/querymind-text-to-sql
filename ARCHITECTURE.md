# Architecture

```
question (<=500 chars, Pydantic-validated)
        |
        v
llm_sql.generate_sql()
  system prompt = ONLY the 5 approved-view schema catalog (db.connection.schema_catalog())
  Claude (claude-sonnet-5-5) returns structured JSON: {sql, assumptions, referenced_views}
        |
        v
sql_validator.validate_sql(sql)          <-- LAYER 1: AST allowlist
  parse with sqlglot (sqlite dialect); reject on parse failure
  reject anything that isn't exactly 1 statement (blocks "SELECT ...; DROP ...;")
  reject anything that isn't a SELECT or WITH...SELECT
  walk the full tree; reject any Insert/Update/Delete/Drop/Alter/Create/Truncate/
    Attach/Pragma/Command/Merge node anywhere, not just at the top level
  reject disallowed functions (load_extension, readfile, writefile)
  reject any table/view reference not in {v_customers, v_products, v_orders,
    v_order_items, v_order_totals} (base tables are never exposed)
        |
        v  (only if validated)
query_executor.execute_validated_sql(sql) <-- LAYER 2: read-only connection
  db.connection.get_readonly_connection(): sqlite3 opened `mode=ro` + PRAGMA query_only=ON
  query wrapped in SELECT * FROM (<query>) LIMIT 501 so the row cap is enforced
  by the executor, not by trusting a LIMIT the model happened to write
        |
        v
query_executor.ground_narrative(question, result)
  builds the answer text ONLY from result.rows/result.columns, there is no
  code path where the LLM's own prose becomes the displayed numeric answer
        |
        v
api.py (FastAPI) -> web/ (React chat UI: question, evidence panel with the
                           exact SQL executed, result table, grounded answer)
```

## Design decisions

- **Two independent layers of defense, deliberately redundant.** The AST validator is the
  primary gate and is where all the adversarial test coverage lives (19 tests), but the
  read-only connection is not decorative, `tests/test_readonly_db.py` proves it rejects writes
  on its own, with the validator bypassed entirely, so a bug in one layer doesn't become a
  full compromise.
- **Views, not tables, are the entire vocabulary the LLM and validator know about.** `db/schema.sql`
  defines the real base tables plus 5 views; `APPROVED_VIEWS` in `db/connection.py` is the single
  source of truth both the validator and the schema-catalog text read from, so a view added there
  is automatically both describable to the LLM and queryable, and a base table never becomes
  query-able by either accident.
- **The grounded answer is structurally incapable of inventing numbers.** `ground_narrative()`
  takes the already-executed `ExecutionResult` and only ever reads `result.rows`/`result.columns`
  - it does not receive or use any text the LLM wrote. The LLM's prose (`assumptions`) is shown
  separately, labeled as the model's own stated reasoning, never mixed into the numeric answer.
- **Row cap enforced by wrapping, not by instruction.** `SELECT * FROM (<validated sql>) LIMIT 501`
  caps results regardless of what the model wrote in its own query, and `truncated` is reported
  to the caller rather than silently dropping rows.
- **Cost/latency logged per call.** `llm_sql.LLMResult` captures `response.usage.input_tokens` /
  `output_tokens` and computes real USD cost per request (Sonnet 5.5 pricing); `recorded_examples.json`
  has actual measured costs from real calls made during this build (total $0.0087 for 3 questions).
