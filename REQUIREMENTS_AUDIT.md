# QUERYMIND, Requirement-Level Audit vs. Original PDF Spec

Generated 2026-10-08. Status legend: **PASS**, **FAIL**, **PARTIAL** (built with a materially
different implementation), **BLOCKED** (needs an external resource this session cannot provision
alone, e.g. a hosting account).

## Tech stack (`tech_stack_and_plugins`)

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| PRD-101 | Python 3.12, FastAPI, Pydantic 2.x | PASS | `api.py` |
| PRD-102 | SQLAlchemy 2.x | **FAIL** | raw `sqlite3` module used directly, no ORM/Core layer |
| PRD-103 | sqlglot | PASS | `sql_validator.py`, 19 adversarial tests |
| PRD-104 | PostgreSQL 17 | **PASS** | real `postgres:17` via `docker-compose.yml`, brought up and verified live (`docker compose up -d --build`); `db/schema.sql` is real Postgres DDL (SERIAL/NUMERIC/DATE), seeded via `db/seed.py` (300 customers/1200 orders/2961 order_items) |
| PRD-105 | Anthropic Python SDK, real calls | PASS | `llm_sql.py`, 3 real recorded calls, 2 real-LLM tests |
| PRD-106 | Redis 7 | **FAIL** | not used |
| PRD-107 | React 19, Vite, TypeScript, Tailwind | PASS | `web/package.json` |
| PRD-108 | shadcn/ui, Radix UI | **FAIL** | plain Tailwind HTML elements |
| PRD-109 | TanStack Query 5.x | PASS | `web/src/App.tsx` uses `useMutation` (wrapping the SSE-first/`/ask`-fallback call) for loading/error/retry instead of manual `useState` |
| PRD-110 | react-markdown, remark-gfm, rehype-sanitize | PASS | `web/src/App.tsx` renders `answer` through `ReactMarkdown` with `remarkGfm` + `rehypeSanitize`; verified with Playwright against a mocked `<script>alert(1)</script>` + `[link](javascript:alert(2))` answer, the script tag produced zero script elements and the javascript: link's `href` attribute was stripped entirely (see `web/screenshots/desktop-1280.png`) |
| PRD-111 | Monaco Editor | PASS | `web/src/SqlEditor.tsx`, read-only, SQL language mode, custom `querymind-dark` theme (obsidian/cobalt/lime); loads monaco from CDN via `@monaco-editor/react`'s default loader so it is not bundled into the main JS chunk |
| PRD-112 | Recharts (result visualization) | PASS | `web/src/ResultChart.tsx`, bar chart (categorical column x numeric column) added alongside the existing HTML table; skips itself for single-scalar results per spec |
| PRD-113 | Motion 12.x / GSAP 3.x (intro) | **FAIL** | intro is hand-rolled Canvas 2D, not these libraries (functionally present, library choice differs) |
| PRD-114 | Server-Sent Events | **FAIL** | single request/response per question; this is the gap the remediation request specifically called out |
| PRD-115 | pytest | PASS | 46 tests |
| PRD-116 | Hypothesis, Vitest, Playwright | **FAIL** | none present |
| PRD-117 | Docker Compose | **FAIL** | no Dockerfile/compose |
| PRD-118 | GitHub Actions CI | **FAIL** | no `.github/workflows/` |
| PRD-119 | OpenTelemetry, Sentry | **FAIL** | not instrumented |

## Multi-agent orchestration

| ID | Requirement | Status |
|---|---|---|
| PRD-120 | Orchestrator + SQL_SECURITY_ENGINEER / CHAT_UI_ENGINEER / VERIFICATION_ENGINEER, isolated JSON handoffs | **PASS** (fixed in the remediation pass) | `.claude/agents/sql-security-engineer.md`, `chat-ui-engineer.md`, `verification-engineer.md` define the three roles with scoped, disjoint file ownership; this remediation was actually executed by separate subagent sessions, each returning the mandated JSON handoff, with the orchestrator independently re-verifying rather than trusting self-reports (fixed 3 real gaps the agents themselves flagged as not in their ownership: a stale SQLite-era LLM prompt, and ARCHITECTURE.md/LIMITATIONS.md left describing the old build) |

## Step-by-step execution

| ID | Step | Status | Evidence |
|---|---|---|---|
| PRD-121 | 01: bootstrap API/web/Postgres/Redis/Docker/CI | **PARTIAL** | API/web exist; Postgres, Redis, Docker, CI do not |
| PRD-122 | 02: commerce schema + approved views | PASS | `db/schema.sql` |
| PRD-123 | 03: DB role SELECT-only + RLS + statement timeouts | **PASS** | real role `querymind_reader` (`db/roles.sql`): `GRANT SELECT` on the 5 views ONLY, zero grant on the 4 base tables, proven by `tests/test_postgres_security.py::test_writes_on_base_table_rejected_by_grants`/`test_direct_select_on_base_table_rejected_by_grants` (live `InsufficientPrivilege`, not asserted); RLS enabled on all 4 base tables with a single policy scoped to a separate `querymind_view_owner` role, proven as a real backstop by `test_rls_blocks_even_with_an_accidental_grant` (an accidental `GRANT` to the reader still returns 0 rows); `ALTER ROLE querymind_reader SET statement_timeout = '3000'` is a real database-enforced execution timeout (not `busy_timeout`'s lock-wait bug), proven by `test_statement_timeout_fires_bypassing_validator` (`pg_sleep(10)`, raw connection, cancelled ~3s) and `test_statement_timeout_fires_on_a_validator_accepted_slow_query` (a real triple cross-join over `v_order_items` that the AST validator accepts, cancelled ~3s via the actual `query_executor.py` path). Deviation from the literal spec: views are NOT `security_invoker = true` - that was tried against a live container first and proven incompatible with a reader role that has zero base-table grants (`permission denied for table`, SQLSTATE 42501 - reproduced in `db/schema.sql`'s header comment and README's "Security model" section); the shipped design (definer-rights views owned by a non-superuser, non-table-owner role that is itself RLS-governed) closes the same risk `security_invoker` targets without that incompatibility. |
| PRD-124 | 04: schema catalog for LLM | PASS | `db/connection.py::schema_catalog()` |
| PRD-125 | 05: LLM response JSON Schema (query/params/assumptions/views/safety) | **PARTIAL** | `sql`/`assumptions`/`referenced_views` present; no explicit `parameters` or `safety_status` field in the LLM's own output (safety status is computed downstream, not asked of the model) |
| PRD-126 | 06-08: one proposed SQL, sqlglot AST validation, reject DDL/DML/multi-stmt/unsafe fn/unauthorized views | PASS | `sql_validator.py` now parses with `read="postgres"` (was `sqlite`) and the function check is an explicit ALLOWLIST (`ALLOWED_FUNC_TYPES`: COUNT/SUM/AVG/MIN/MAX/ROUND/COALESCE/CAST/EXTRACT/DATE_TRUNC/CASE/UPPER/LOWER), default-deny on everything else - not the SQLite build's DENYLIST, which would have missed `pg_sleep`/`pg_read_file`/`dblink`/`lo_import`/`set_config` entirely on Postgres; 30 validator tests (was 19), all passing |
| PRD-127 | 09: bound params + limits + cost/time caps + read-only transaction | **PARTIAL** | row cap real and unchanged; real time cap now exists (see PRD-123, 3s `statement_timeout`); "read-only transaction" is now a real one - `db/connection.py::get_readonly_connection()` calls psycopg2's `set_session(readonly=True)`, which issues `SET TRANSACTION READ ONLY` at the wire level, proven independent of role grants by `tests/test_postgres_security.py::test_read_only_transaction_blocks_write_even_for_the_admin_role` (the *admin* role, which could otherwise write, is still blocked by transaction mode alone); still no query-cost estimation before execution (remains a gap, not attempted) |
| PRD-128 | 10: persist SQL/validation/row count/timings/checksum | **FAIL** | nothing is persisted between requests; no query log table, no checksum |
| PRD-129 | 11: chat/session/schema/results APIs + sequenced SSE stage events | **FAIL** | no session concept at all (each `/ask` is independent), no SSE |
| PRD-130 | 12: question-to-SQL intro, chat, Monaco, result table, charts, evidence panel | PASS | intro/chat/table/evidence panel built; Monaco (`SqlEditor.tsx`) and Recharts bar chart (`ResultChart.tsx`) now added to the evidence panel alongside the table |
| PRD-131 | 13: ground narrative in execution results, sanitize Markdown | **PARTIAL** | grounding is real and tested; Markdown sanitization is moot since no Markdown is rendered (not a security gap today, but a spec deviation) |
| PRD-132 | 14: golden question-to-result equivalence test, prompt injection, performance/cost test | **PARTIAL** | prompt-injection tested (real + unit); no golden-query regression suite; no load/performance test |
| PRD-133 | 15: deploy with secure role + threat model doc | **PARTIAL** | threat model documented (`ARCHITECTURE.md`/`LIMITATIONS.md`); nothing deployed |

## Verification criteria

| ID | Requirement | Status |
|---|---|---|
| PRD-134 | Schema validation for request/SQL-metadata/result | PASS |
| PRD-135 | Reject empty/huge/invalid JSON/unknown tenant/invalid params | **PARTIAL**, no tenant concept exists at all (single-tenant app), so "unknown tenant" rejection is untestable as specified |
| PRD-136 | Reject INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/COPY/stacked SQL/unsafe fns | PASS | plus new Postgres-specific bypass vectors flagged in the remediation review: a writable CTE (`WITH d AS (DELETE ... RETURNING *) SELECT * FROM d`, rejected via the `Delete` node being present anywhere in the tree), `SELECT ... INTO new_table` (rejected via the `Select.args["into"]` check, since it has no DDL/DML node type at all), `FOR UPDATE`/`FOR SHARE` (rejected via `Select.args["locks"]`), and `set_config`/`pg_sleep`/`pg_read_file`/`dblink`/`lo_import` (all rejected by the function allowlist, not individually named) - see `tests/test_sql_validator.py` |
| PRD-137 | Nested CTE bypass attempts; read-only DB role independent of validator | PASS, CTE bypass tested and blocked (alias-name confusion was a real bug found and fixed, plus the new writable-CTE case in PRD-136); the "DB role" is now `querymind_reader`, a real least-privilege Postgres role with no base-table grant at all, proven independent of the validator by raw-connection tests in `tests/test_postgres_security.py` that never call `sql_validator.validate_sql` |
| PRD-138 | Cross-tenant access, injected DB text, user prompt injection | **PARTIAL**, prompt injection tested (real); cross-tenant N/A (no tenancy); "injected DB text" (second-order injection via data in the DB) not specifically tested |
| PRD-139 | Timeout, row cap, cancellation, connection-failure handling | **PARTIAL**, row cap real and tested (unchanged); timeout is now real (see PRD-123) and the *timeout's own* cancellation is proven live - `psycopg2.errors.QueryCanceled` (SQLSTATE 57014) actually raised and caught in `query_executor.py`, not simulated; connection-failure handling is now exercised by `tests/test_connection_failure.py` (points `DATABASE_URL` at an unreachable port, or unsets it, via `monkeypatch`, asserts a clean `ExecutionResult(ok=False, ...)` instead of an unhandled exception reaching `api.py`). Still not real: *client-initiated* cancellation - nothing cancels an in-flight query when a caller disconnects from `/ask` or `/ask/stream` mid-request; it keeps running on the server until the 3-second `statement_timeout` fires on its own. These are two different "cancellation" properties and only the timeout-triggered one is implemented. |
| PRD-139a | GLOBAL NEGATIVE-INPUT GATE: unauthorized access | **FAIL**, the app has no authentication at all; every request is treated as authorized, so there is no unauthorized case to test |
| PRD-139b | GLOBAL NEGATIVE-INPUT GATE: service outage/timeout | **PARTIAL**, the DB side is now real and tested (see PRD-123/PRD-139: real timeout, real connection-failure handling); the LLM call path (`llm_sql.py`, not owned by this track) still has no simulated-outage test and `generate_sql()` raises uncaught on a missing/invalid Anthropic key or API outage - reproduced live during this build (`/ask/stream` caught it cleanly via its `error` SSE event; plain `/ask` would still surface it as an unhandled exception) - flagged as a follow-up, not fixed here, since `llm_sql.py`/`api.py`'s `/ask` body are outside this subagent's ownership |
| PRD-140 | Compare generated answers to executed rows; golden execution accuracy | **PARTIAL**, grounding is structurally guaranteed (code can't invent numbers) but there is no labeled golden-answer accuracy benchmark |
| PRD-141 | SSE chunking/disconnect/reconnect/cancellation/terminal error | **PARTIAL**, client-side half only: `web/src/api.ts::streamAsk()` is a `fetch`+`ReadableStream` POST client (native `EventSource` can't POST a body) that parses chunked `event:`/`data:` SSE frames and drives a live "Asking Claude… → Validating SQL… → Running query…" status line; verified against a disposable Node stub server that mirrors the documented stage contract, true chunked delivery confirmed, not a Playwright-mocked atomic body. Any stream failure (terminal error, 404, parse failure) falls back to plain `POST /ask` transparently rather than hanging. NOT implemented: reconnect-on-disconnect and user-initiated cancellation (no `AbortController` wired to a UI control yet). Live end-to-end integration against the real backend `/ask/stream` endpoint is pending, that endpoint (owned by sql-security-engineer) was not present in `api.py` as of this session |
| PRD-142 | Markdown sanitization vs script/HTML injection | **FAIL**, moot, no Markdown rendering exists to sanitize |
| PRD-143 | pytest/Hypothesis/Vitest/Playwright/accessibility/production build | **PARTIAL**, pytest only (46 tests); Hypothesis/Vitest/Playwright/automated a11y absent |

## Summary

Computed by `python3 scripts/count_audit.py REQUIREMENTS_AUDIT.md` against this file's own rows
(an earlier hand-tally undercounted the row total, 35 vs the actual 45):

**45 tracked requirements: PASS 19 · PARTIAL 13 · FAIL 13.** (PRD-120, the literal 3-subagent
orchestration requirement, flipped to PASS once this remediation pass itself used three real
subagent sessions with scoped ownership and JSON handoffs, see that row for detail. The
orchestrator also fixed 3 stale-file gaps the sql-security-engineer subagent flagged as
out of its own ownership: `llm_sql.py`'s system prompt still described a SQLite schema and
didn't mention the new Postgres function allowlist, live-verified against the real Claude
API and real Postgres after the fix, and `ARCHITECTURE.md`/`LIMITATIONS.md` were rewritten
to describe the actual Postgres/RLS/timeout/SSE build instead of the old SQLite one.)

The security-critical claim this app makes, an untrusted LLM-proposed query cannot write or
escape its allowlist, is real and adversarially tested (36 validator tests + 5 connection-level +
2 connection-failure + 10 live-Postgres-only + 2 real-LLM = 55 security-relevant tests across
`tests/test_sql_validator.py`, `tests/test_readonly_db.py`, `tests/test_connection_failure.py`,
`tests/test_postgres_security.py`, and `tests/test_api.py`). The validator's CTE handling had a
real bug found and fixed during this hardening pass, not just a theoretical one: the original
check treated "is this name a CTE alias" as a single global set, so
`WITH pg_tables AS (SELECT * FROM pg_tables) SELECT * FROM pg_tables, v_customers` was wrongly
accepted - the inner `pg_tables` actually resolves to the real `pg_catalog.pg_tables` relation,
since a non-recursive CTE can't see its own name. The validator now resolves CTE names in
definition order, the same way Postgres does (`tests/test_sql_validator.py`'s
`test_cte_name_shadowing_*`/`test_cte_forward_reference_*`/`test_nested_with_*`/
`test_with_recursive_rejected`). The three consequential gaps the previous audit named here are now
closed against a real, live `postgres:17` via docker compose, not just claimed: (1) a real
least-privilege role (`querymind_reader`, zero base-table grants, an RLS backstop even against
an accidental grant) replaces SQLite's `query_only` flag (PRD-104/123/137); (2) a real
database-enforced `statement_timeout` (3s, role-level) replaces the `busy_timeout` lock-wait bug,
proven by actually cancelling both a raw `pg_sleep(10)` and a validator-accepted slow cross-join
(PRD-123/127/139); (3) the backend `/ask/stream` SSE endpoint now exists in `api.py`
(`generating_sql` -> `validating` -> `executing` -> `answer`/`error` events), exercised
end-to-end against the live database with a monkeypatched LLM call - the chat-ui-engineer's SSE
client (PRD-141) was built and stub-tested before this endpoint landed and still needs a live
integration pass against it. The validator itself moved from a SQLite-dialect DENYLIST to a
Postgres-dialect function ALLOWLIST (PRD-126/136), closing the specific hole a denylist leaves on
Postgres (`pg_sleep`/`set_config`/`pg_read_file`/`dblink`/`lo_import` were never individually
denylisted; they're simply not on the allowlist). Remaining gaps in this track: no query-cost
estimation before execution (PRD-127); no client-initiated cancellation on disconnect, only the
3-second timeout firing on its own (PRD-139); and the LLM-outage path (PRD-139b) is still
unhandled in plain `POST /ask` (`llm_sql.py`/that endpoint's body are outside this subagent's
ownership).
TanStack Query, Monaco, Recharts, and react-markdown/remark-gfm/rehype-sanitize are implemented
and verified (PRD-109 to PRD-112); shadcn/ui and Radix UI (PRD-108) remain a
functional-equivalent substitution (plain Tailwind elements), not a security or correctness gap.

## Independent Verification Pass (verification-engineer)

Everything below was re-run or re-attacked independently in this pass: no row here is a
re-statement of another subagent's self-report. Full raw evidence lives in
`artifacts/verification/`. New adversarial regression tests live in
`tests/test_verification_adversarial.py` (a new file; no existing test file owned by
sql-security-engineer or chat-ui-engineer was edited).

**ORCHESTRATOR FOLLOW-UP: the bypass below is now fixed and re-verified live, same day it was
found.** `sql_validator.py` now checks `table.db`/`table.catalog` (schema qualification) before
ever treating a table reference as a CTE match, a qualified reference (`pg_catalog.pg_roles`,
`public.customers`, etc.) is always checked against `APPROVED_VIEWS` regardless of any
same-named CTE alias in the query. The window-function (`COUNT(*) OVER (...)`) and `||` concat
gaps were fixed the same way (explicit rejection of `exp.Window` and `exp.DPipe` nodes). All 4
originally-`xfail`-pinned bypass tests plus both documentation-mismatch tests now pass as plain
asserts (flipped from `xfail(strict=True)`, per the verification-engineer's own `next_action`
recommendation), **87 passed, 2 skipped**, up from 75/2. The exact live attack
(`WITH pg_roles AS (...) SELECT rolname, rolsuper FROM pg_catalog.pg_roles`) was re-sent to the
rebuilt, running Docker container (`docker compose up -d --build api`) and now returns
`"safety_status": "rejected"` instead of 18 real rows including `postgres`/`rolsuper: true`; a
legitimate query (`SELECT * FROM v_customers LIMIT 2`) was confirmed to still work on the same
rebuilt container. The full fresh-checkout `scripts/docker_smoke_test.sh` was re-run after the
fix and passed. See `sql_validator.py`'s updated comments and `tests/test_verification_adversarial.py`'s
updated docstring for the full before/after narrative.

**Original finding (read for context on what was found and how): a real, live bypass was found
and confirmed through the actual `/execute` API endpoint against a freshly
`docker compose down -v && up -d --build` stack** (not a theoretical unit-test case). `sql_validator.py`'s CTE-name-shadowing defense -
the one PRD-137/PRD-126 describe as "resolving CTE names in definition order, the same way
Postgres does" - compares only the bare, schema-unqualified `table.name` against CTE names
defined so far, and never checks whether the reference was schema-qualified
(`table.db`/`table.catalog`). A CTE name can never be schema-qualified in real Postgres, so
`pg_catalog.pg_roles` or `information_schema.tables` always means the real catalog relation,
with or without a same-named CTE in scope - but the validator treats a matching bare name as "a
safe reference to my own CTE" regardless of the qualifier and skips the `APPROVED_VIEWS` check
entirely. Confirmed live through `POST /execute`:
`WITH pg_roles AS (SELECT 1 AS x FROM v_customers) SELECT rolname, rolsuper FROM
pg_catalog.pg_roles` returned `safety_status: "validated"` and 18 real rows, including
`postgres`/`rolsuper: true`. The equivalent against `information_schema.tables` returned a
196-row full catalog/schema enumeration. A `pg_stat_activity` variant also validated and ran,
though Postgres's own per-row visibility rules (not the validator) limited it to the calling
session plus `<insufficient privilege>` placeholders for others. A control case,
`WITH customers AS (SELECT * FROM v_customers) SELECT * FROM public.customers`, proves this is
a validator bug and not something the DB grants paper over in general: it is **also** wrongly
accepted by `validate_sql()`, and is only stopped at execution time because `customers`
happens to have no grant for `querymind_reader` - it would not have stopped `pg_roles` or
`information_schema.tables`, which are world-readable in Postgres by default. See
`artifacts/verification/schema_qualified_cte_bypass.txt` (unit level) and
`artifacts/verification/schema_qualified_cte_bypass_live_api.txt` (live `/execute` responses),
and the 4 new `xfail(strict=True)` tests + 1 passing control-case test in
`tests/test_verification_adversarial.py`. This does not reach write access or the base tables
that actually hold business data (those remain correctly blocked by role grants), but it does
defeat the AST-validator layer entirely for Postgres catalog/metadata objects, which is exactly
the class of object PRD-136's "unsafe fn" framing and PRD-137's CTE-shadowing fix were meant to
close off.

- PRD-101 (Python 3.12, FastAPI, Pydantic 2.x): ✅ confirmed. `api.py` imports `FastAPI`/`pydantic.BaseModel`; the venv used to run the full suite reports `Python 3.12.13`.
- PRD-103 (sqlglot, 19 adversarial tests): ⚠️ sqlglot usage confirmed, but the test count is stale and internally inconsistent across this same document: this row says "19", PRD-126 says "30 (was 19)", and the Summary section says "36" - `grep -c "^def test_" tests/test_sql_validator.py` actually returns **36** right now, so only the Summary's figure is currently correct.
- PRD-104 (PostgreSQL 17, live, seeded): ✅ confirmed independently, not re-trusted. I personally ran `docker compose down -v` (full volume wipe) then `docker compose up -d --build` from that clean state (per this task's explicit instruction, since this had never been proven for QUERYMIND the way it had for PREDICTIVE), waited for postgres/redis health, and ran `db/seed.py`, which reproduced the documented `300 customers, 1200 orders, 2961 order_items` exactly.
- PRD-105 (Anthropic SDK, real calls): ⚠️ not independently re-confirmed. No `ANTHROPIC_API_KEY` was available in this environment (checked explicitly), so per task 3's own instruction this was skipped rather than faked. `llm_sql.py`'s `generate_sql()` does structurally make a real (not mocked) `anthropic.Anthropic().messages.create(...)` call and the prompt now correctly describes the Postgres schema/allowlist (confirmed by reading the file), but the "3 real recorded calls, 2 real-LLM tests" claim itself rests on a prior session's run I could not reproduce.
- PRD-107 (React 19, Vite, TypeScript, Tailwind): ✅ confirmed. `web/package.json`: `react@19.2.8`, `vite@8.3.0`, `tailwindcss@4.3.3`, `typescript@~6.0.2`.
- PRD-109 (TanStack Query): ✅ confirmed by direct code read. `web/src/App.tsx` line 1 imports `useMutation` from `@tanstack/react-query` and uses it at line 91.
- PRD-110 (react-markdown/remark-gfm/rehype-sanitize, XSS-tested): ✅ confirmed independently with a properly-installed Playwright, not the borrowed `~/portfolio/node_modules/playwright` the chat-ui-engineer used (flagged in this task as fragile). Installed `@playwright/test` as a real `devDependency` in `web/package.json` + `chromium` browser, wrote an independent test script (not a re-run of theirs), and reproduced: a mocked `<script>alert(1)</script>` + `[link](javascript:alert(2))` answer rendered with `scriptCount: 0`, `rawScriptLiteral: false`, `jsHrefAnchors: 0`. See `artifacts/verification/playwright_independent_run.txt`.
- PRD-111 (Monaco Editor): ✅ confirmed. `web/src/SqlEditor.tsx` exists and `App.tsx` imports it; independently screenshotted via Playwright (`artifacts/verification/verify_desktop_1280.png`).
- PRD-112 (Recharts): ✅ confirmed. `web/src/ResultChart.tsx` exists and is imported in `App.tsx`.
- PRD-115 (pytest, 46 tests): ⚠️ stale count. Actual collected test count prior to this verification pass was **77** (`59 passed + 18 skipped` with no env vars; `75 passed + 2 skipped` with the full stack + env vars - both independently re-run by me, see below), not 46.
- PRD-120 (3-subagent orchestration with JSON handoffs): ✅ confirmed to the extent checkable from this session: `.claude/agents/sql-security-engineer.md`, `chat-ui-engineer.md`, and `verification-engineer.md` exist with scoped, disjoint tool/file ownership exactly as described. (Whether the underlying subagent conversations actually happened as narrated isn't independently verifiable from inside this session; the artifacts the process should have produced - the Postgres migration, the frontend changes, the stale-prompt fix - are all independently confirmed present and working elsewhere in this section.)
- PRD-122 (commerce schema + approved views): ✅ confirmed. `db/schema.sql` defines the 4 base tables + 5 views; all 5 approved views (`v_customers`, `v_products`, `v_orders`, `v_order_items`, `v_order_totals`) were independently queried live via `/execute` during this pass.
- PRD-123 (DB role SELECT-only + RLS + statement timeout): ✅ confirmed for the claims actually tested in `test_postgres_security.py` (re-ran all 7, all pass against my freshly rebuilt stack); ✅ independently reproduced outside that file too - raw `psycopg2` connections (bypassing the validator and the app entirely) as `querymind_reader` were rejected with `InsufficientPrivilege: permission denied for table <t>` on all 4 base tables and on INSERT/UPDATE/DELETE against `v_customers`; `SHOW statement_timeout` on a fresh raw connection returned `3s` as documented. ⚠️ one nuance this row doesn't mention: an ordinary (non-superuser) role can always override its own session's `statement_timeout` for itself - `SET statement_timeout = 0` on a raw `querymind_reader` connection succeeded and a subsequent `pg_sleep(4)` then ran to completion uncancelled (`artifacts/verification/timeout_override_attempt.txt`). This is **not** reachable through the app - `validate_sql()` rejects any bare `SET`/`RESET` statement outright since it isn't a SELECT/CTE (confirmed, also pinned by a new regression test) - so the "independent of the validator" framing holds in practice, but only because the validator's top-level statement-type check is what's actually doing the protecting here, not anything about the role itself being unable to do this.
- PRD-124 (schema catalog for LLM): ✅ confirmed. `db/connection.py::schema_catalog()` returns the narrow 5-view description; read in full.
- PRD-126 (AST validation, reject DDL/DML/unsafe fn/unauthorized views, "30 validator tests"): ⚠️ **see the bypass writeup at the top of this section** - the "unauthorized views" rejection has a real, confirmed hole for schema-qualified catalog references shadowed by a same-named CTE. Separately, and lower severity: `llm_sql.py`'s own system prompt states "no window functions" and "no string concatenation functions" are available, but `COUNT(*)/SUM(...) OVER (...)` and the `||` operator both validate and execute live against the real database (confirmed through `/execute`, not just the unit level) - these don't escape the approved-views sandbox (same data a plain SELECT could already read), so they're a documentation/prompt mismatch rather than a security bypass, but they are real discrepancies between this row's "unsafe fn" framing and actual behavior. Test count is also stale/inconsistent (see PRD-103 above: actual is 36, not "30 (was 19)").
- PRD-130 (intro/chat/Monaco/table/evidence panel): ✅ confirmed independently via Playwright: example-question chips, Ask button, and evidence-panel flow all present and interactive; reduced-motion intro confirmed to skip immediately (`canvasCount: 0` with `reducedMotion: 'reduce'`), matching the claim in `web/screenshots/verification-results.md`.
- PRD-134 (schema validation for request/SQL-metadata/result): ✅ confirmed. Re-ran `test_ask_empty_question_rejected`, `test_ask_huge_question_rejected`, `test_ask_missing_field_rejected`, `test_ask_malformed_json_rejected`, `test_execute_missing_field_rejected`, `test_execute_oversized_sql_rejected` - all 422 as claimed.
- PRD-136 (reject INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/COPY/stacked SQL/unsafe fns): ⚠️ confirmed for every statement type and function explicitly named in this row (independently re-attacked live via raw SQL and `/execute`, not just re-run from the existing suite) - but see the schema-qualified-CTE bypass at the top of this section and the window-function/`||` notes under PRD-126: both were found by attacking `validate_sql()` directly with inputs not in this row's enumerated list, exactly the category task 2(d) asked for.
- PRD-137 (nested CTE bypass tested and blocked; DB role independent of validator): ⚠️ **this is the row the top-of-section bypass most directly contradicts.** The "alias-name confusion" bug this row says was "found and fixed" was fixed only for schema-UNqualified name collisions; a schema-qualified variant of the identical bug class (`pg_catalog.pg_roles` shadowed by a bare CTE alias named `pg_roles`) remains and was live-confirmed through `/execute` in this pass. The "DB role independent of validator" half of this row is separately ✅ confirmed (re-verified directly: raw connections as `querymind_reader` cannot read or write base tables regardless of what SQL text reaches them).

**Suite totals, independently re-run by me (not re-quoted from another agent):**
- No env vars set at all: **59 passed, 18 skipped**, 0 failed (unchanged from before this pass - confirms the orchestrator's skip-gate on `test_execute_valid_select` works as intended).
- Full stack up (`docker compose down -v && up -d --build`, freshly seeded) + `DATABASE_URL`/`ADMIN_DATABASE_URL`/`REDIS_URL` set, no `ANTHROPIC_API_KEY`: **75 passed, 2 skipped** (the 2 being the `ANTHROPIC_API_KEY`-gated LLM tests in `test_api.py` - correct behavior, not a bug).
- With `tests/test_verification_adversarial.py` added (12 new tests: 6 passing regression cases + 6 `xfail(strict=True)` cases pinning the confirmed bypasses above): **65 passed, 18 skipped, 6 xfailed** (no env) / **81 passed, 2 skipped, 6 xfailed** (full stack).
- `scripts/docker_smoke_test.sh` (new file, this pass): full `down -v -> up -d --build -> seed -> /health -> /ask/stream SSE shape -> ps -> down -v` cycle, actually executed twice during this pass, both runs `SMOKE TEST PASSED`. Without an `ANTHROPIC_API_KEY`, `/ask/stream` correctly degrades to a terminal `error` SSE event after `generating_sql` (an uncaught `anthropic` auth error inside the stream generator, turned into a clean SSE `error` event by `api.py`'s own except-block, exactly as `ask_stream`'s docstring documents) - the script treats this as the expected shape, not a failure. See `artifacts/verification/docker_smoke_test_output.txt`.
