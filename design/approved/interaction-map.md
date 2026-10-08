# Interaction map (approved)

## 1. The validator worker: the one engine

Every verdict on the site comes from one Web Worker.

### What it loads

- Pyodide, pinned and self-hosted, or a pinned exact-version CDN URL.
- `sqlglot==30.21.0` as a **pinned wheel served from `site/public/py/`**. It is never installed with a floating `micropip.install("sqlglot")`.
- `sql_validator.py`, copied **byte-identical** from the repo root at build time. A build step fails if its SHA-256 differs from the repo file.
- `sql_validator_before.py`, the RECONSTRUCTED file. It is generated at build time from the current file by reverting exactly 3 hunks:
  - `_is_unqualified(table) and ` removed, in 2 places;
  - the `exp.Window` / `exp.DPipe` block removed.
  - The build step asserts that each hunk matched exactly once.
- `db/__init__.py` (empty) and a stub `db/connection.py` that contains only `APPROVED_VIEWS = {…}`. A build step asserts that the set is equal to the set in the real `db/connection.py`, by parsing the real file's literal rather than importing it.

### Message contract

```
→ { id, sql, version: "current" | "before" }
← { id, ok, reason, referenced_views, regenerated_sql, gate, statements, ast, offending_node_id, ms }
```

- **`gate`** comes from the reason string by prefix. Accepted queries get `G11`.

| Reason prefix | Gate |
|---|---|
| `empty SQL`, `SQL did not parse` | G1 |
| `expected exactly 1 statement` | G2 |
| `only SELECT/CTE` | G3 |
| `disallowed statement type` | G4 |
| `SELECT ... INTO`, `FOR UPDATE/FOR SHARE` | G5 |
| `disallowed function` | G6 |
| `window functions`, `the \|\| concatenation` | G7 |
| `nested WITH`, `WITH RECURSIVE` | G8 |
| `unapproved table/view` | G9 |
| `query references no table` | G10 |

  - The same table lives in the Python fixture generator, so gates are part of the parity check.
  - An unknown prefix maps to `G?`. The UI shows the reason with no gate highlight, and dev mode asserts.
- **`ast`** is a flat list built from sqlglot's own `walk()` over the parsed statement(s): `{id, parent_id, cls, label, depth}`.
  - `label` is the identifier, literal or function name.
  - `Table` nodes also carry `db`.
  - This glue code lives in the worker, not in the validator file.
- **`offending_node_id`** is located from the reason, in glue code. It is labeled in the UI as "located from the validator's reason".

| Gate | Node located |
|---|---|
| G9 | the first `Table` named X whose `db`/`catalog` is set or whose name is not a visible CTE; otherwise the first `Table` named X |
| G6 | the first `Func` whose name matches |
| G7 | the first `Window` or `DPipe` |
| G4 | the first node of the named class |
| G5 | the `Select` carrying `into` or `locks` |
| G8 | the offending `With` |
| G3, G10 | the root |
| G2 | the root of statement 2 (both trees are shown) |
| G1 | none; sqlglot's message is shown |

### One Python glue file, run in two places

The AST serializer, the reason→gate table and the offending-node locator live in **one** file, `scripts/verdict_glue.py`.

- The **fixture generator imports it** and writes `{gate, referenced_views, ast, offending_node_id}` onto **every recorded query**: the 12 questions, 6 demos, 65 grid entries, corpus (both versions) and breach evidence.
- The **worker runs the same file** in Pyodide.
- This gives two results:
  1. The RECORDED fallback is complete *without WASM*. The 390 px Inspector's syntax tree and inline offending node, the lit views, and the desktop intro before Pyodide is ready all render from fixtures.
  2. Parity compares trees and gates, not only verdicts.

### Reason-string display

- sqlglot's `ParseError` text contains ANSI underline escapes. This was verified: `SELECT * FROM (v_customers` yields `…(\x1b[4mv_customers\x1b[0m`.
- **Parity compares the raw string.**
- **Display strips `\x1b[...m`** and renders the underlined span as a silver underline in the reason.

### Concurrency and limits

- One request is in flight at a time. A newer request supersedes queued ones, and stale responses are dropped by `id`.
- Input is capped at 2,000 characters. The UI says so at the cap.
- A 1,500 ms watchdog applies. If it fires, the worker is terminated and restarted, and the UI shows `not judged · the parser took too long`. It never shows a guessed verdict.

### Parity (gates the LIVE badge)

1. When the worker is ready, it judges all Claude SQL, the 6 demos and the full corpus under both versions.
2. It compares `ok`, the `reason` string and `gate` against the recorded Python results.
3. **Only at 100% does the ledger say LIVE.** On any mismatch, it says `parity {k}/{n} · showing recorded verdicts`. Recorded verdicts are then used everywhere, and the console is disabled with that explanation.

## 2. Question Explorer (Beat 1)

| Input | Result |
|---|---|
| Click or Enter on a question | It becomes the band query, the canonical verdict animation runs, and the Inspector updates. URL hash `#q=revenue-1`. |
| Arrow keys | Move within a category column (↑↓) and across categories (←→). It is a roving-tabindex grid. |
| Security questions | The LLM-decline animation plays. The Inspector shows Claude's decline text, with `no SQL produced`. A button reads "Send the attack to the validator directly". It loads the matching corpus case into the console: `DROP TABLE customers`, or a catalog query. |

## 3. SQL Inspector (Beat 1b, and the lower deck everywhere)

- **Question.** Phrase links come from the deterministic matcher (`scroll-storyboard.md`). Hovering a phrase lights its clause and AST node, and the reverse works too.
- **Stored SQL** is RECORDED (`questions.json.sql`). The generator wrote `result.sql`, so this is *already* the backend's regenerated output, not Claude's raw text. **Re-regenerated SQL** is LIVE.
  - A probe on 2026-10-08 confirmed that all 10 are string-identical after regeneration.
  - The gutter reads `regenerated again in your browser · identical`. It never fakes a difference.
  - If `proposed_sql` (raw `llm.sql`) is added to the fixture later, the top block becomes `proposed by Claude`, and real differences show.
- **Views.** The 5 views come from `schema_catalog.json.approved_views`, with columns parsed from `catalog_text`. Views in the LIVE `referenced_views` are lit.
- **AST.** A tidy tree with a cap of about 40 visible nodes. Click a node to see `cls`, its label, and the gate that inspects that class (a static map, documented in the legend).
- **Result.** Up to 8 rows are visible and the rest scroll. Shows `row_count` and the truncation note. Single-value results are rendered as a big number.
- **Assumptions and cost** are RECORDED. Cost is formatted `$0.004544`.

## 4. Result Visualization (Beat 2)

- A `table · bar · line` segmented control, implemented as radio buttons.
- **Bar** is valid for 2 or more rows with exactly one numeric column.
- **Line** is valid only when the dimension column is ordered, which today means only `order_month` from the builder grid.
- Invalid views are disabled with a visible reason.
- Hovering a mark lights its table row, and the reverse works too. The same object moves in all three views (FLIP).
- **Data sources:** the selected question's rows, or any builder grid entry. A picker in this beat offers the questions with 2 or more rows, plus "Monthly completed revenue (builder)".

## 5. Visual Query Builder (Beat 3)

The finite space is **precomputed, and the client never invents SQL**.

**The bounded enumeration** (new `query_builder_grid.json`, generated by `scripts/generate_site_fixtures.py` against the real `querymind_reader` role):

| Axis | Values |
|---|---|
| Dimension | `city` (v_customers) · `category` (v_products) · `status` (v_orders) · `order_month` = `DATE_TRUNC('month', o.order_date)` |
| Measure | `orders` = `COUNT(DISTINCT o.order_id)` · `revenue` = `ROUND(SUM(oi.quantity * oi.unit_price), 2)` · `units` = `SUM(oi.quantity)` · `customers` = `COUNT(DISTINCT o.customer_id)` · `avg_order_value` = revenue / orders, rounded to 2 |
| Status filter | `all` · `completed` · `cancelled` · `returned` (only `all` when the dimension is `status`) |

- **Base join:**
  ```
  v_order_items oi
    JOIN v_orders o ON o.order_id = oi.order_id
    JOIN v_customers c ON c.customer_id = o.customer_id
    JOIN v_products p ON p.product_id = oi.product_id
  ```
- **Ordering:**
  - `ORDER BY value DESC` for unordered dimensions;
  - `ORDER BY dim` for `order_month`.
- **Total:** 3×5×4 + 1×5×1 = **65 real executions**.
- **Caption:** "Counts orders with at least one line item." Orders with no items are excluded by the join, so the caption makes this honest.
- **Entry shape:**
  ```
  { key: "city|revenue|completed", dimension, measure, status,
    sql /* the validator-regenerated SQL that actually ran */,
    columns, rows, row_count }
  ```
- The 3 legacy entries are kept only if they are re-keyed into this shape. Otherwise they are dropped.

**Interaction:**

| Input | Result |
|---|---|
| Chip change | The key is looked up. The slug text changes to that entry's `sql`, and only the changed clause re-sets (`wdth` flicker 87 → 112 → 87, 420 ms). The SQL is LIVE-validated through the gates. Rows land, RECORDED. |
| Invalid combination | Chips that would form a missing key are disabled. This is computed from the keys present, never hard-coded. |
| "Open in console" | Loads the entry's SQL into the console. |

**Line view hand-off:** when the dimension is `order_month`, Beat 2's line view becomes available for this entry.

## 6. Security Demonstrations, Console and Corpus (Beat 4)

### Demos

The 6 cards come from `security_demos.json`. Each card shows the label, SQL, LIVE verdict, and RECORDED reason. A mismatch between LIVE and RECORDED is shown, never hidden.

### Console

| Input | Result |
|---|---|
| Typing | 120 ms debounce, then the worker is called. The slug slides to the new gate. The AST and verdict update. A `role=status` live region announces "Rejected at gate 9, table scope. unapproved table/view referenced: pg_roles" or "Accepted. Not executed: static site." |
| Cmd/Ctrl+Enter | Judge immediately. |
| Version switch (`role=switch`) | Re-judge under `before`. The RECONSTRUCTED hatch appears on the ledger and the verdict. When `before` accepts and `current` rejects, the verdict reads `accepted by the old validator`, followed by the class label and color from `colors.md` rule 3. Only `pg_catalog`/`information_schema` references are breach-red. Other qualified tables are silver (`role grants decide`). G7 is silver-dim (`no data escape`). |
| Accepted under the current validator | NOT EXECUTED panel, *unless* `regenerated_sql` string-equals a recorded execution. The recorded executions are the 10 question SQLs, the 1 demo SELECT, the 65 grid entries and the 3 breach attacks. If it matches, the recorded rows are shown with the label `recorded execution of this exact SQL`. |
| Accepted under `before` and equal to one of the 3 recorded attacks | The EVIDENCE rows are shown, cited. Any other variant reads `would have reached the database · no recorded rows for this exact query`. |
| Restore | Puts back the last example loaded. |
| Example menu | "Try one of these": all corpus families. |

**Field:**

- A `<textarea>` with `spellcheck=false`, `autocapitalize=off` and `autocomplete=off`, set in Martian Mono `wdth` 87.
- It has **no submit button**. It never looks like a chat input. It sits *under* the band, and its caret is lime.

### Corpus matrix

- **Source:** new `attack_corpus.json`, about 40 entries, generated in Python. Each entry is:
  ```
  { id, family, label, sql, source, current: {ok, reason, gate}, before: {ok, reason, gate} }
  ```
- **Families:**
  - statement type (DELETE, DROP, UPDATE, INSERT, TRUNCATE, ALTER, `SET statement_timeout = 0`);
  - multi-statement;
  - writable CTE;
  - `SELECT … INTO`;
  - `FOR UPDATE`;
  - functions (`pg_sleep`, `set_config`, `pg_read_file`, `dblink`, `lo_import`, `pg_catalog.pg_sleep`);
  - window and `||`;
  - nested WITH and WITH RECURSIVE;
  - unqualified CTE shadow (`pg_tables`);
  - schema-qualified CTE shadow (the 5 recorded cases);
  - quoted and case variants (`"pg_catalog"."pg_roles"`, `PG_CATALOG.PG_ROLES`);
  - `SELECT 1`;
  - empty;
  - unparsable;
  - plus legitimate controls.
- **`source`** cites the test file, audit section or demo each case came from. Novel probes are marked `source: "design probe"`.
- **Interaction:**
  - Filter by gate.
  - "Show divergent only".
  - Click a row to load it into the console.
  - The version switch re-judges the whole matrix (cells re-tick with a 20 ms row stagger).

## 7. Breach (Beat 5)

| Control | Result |
|---|---|
| Exhibit tabs: `pg_roles` · `information_schema.tables` · `pg_stat_activity` | Swap the attack slug and the EVIDENCE rows. |
| "Apply the fix" (a large `role=switch`) | Runs the before-to-current choreography. It can be toggled back and forth indefinitely. |
| "Try a variant" | Loads the attack into the console with the version set to `before`. |
| Diff hunk hover | Lights the gate it changed and the AST field (`Table.db`) it reads. |

`breach_evidence.json` (new) holds the 3 recorded `/execute` responses, parsed verbatim from `artifacts/verification/schema_qualified_cte_bypass_live_api.txt`, plus the `public.customers` control response.

## 8. Global

- **Top bar:** anchors to each beat. The current beat is marked with `aria-current`.
- **Ledger** (bottom left, always visible): the validator state, the LIVE dot, the sha, and Replay intro / Skip.
- **Deep links:**
  - `#q=<slug>`
  - `#demo=<n>`
  - `#sql=<base64url>` pre-fills the console. It is judged locally and never executed.
  - `#breach`
- **No network calls** after the fixtures and the worker assets have loaded. There are no LLM calls, ever.
- **Failure states:**
  - **Fixture fetch fails.** The beat shows `data unavailable` in silver-dim.
  - **Worker fails to load**, or there is no WASM. The ledger reads `validator unavailable · recorded verdicts only`. The console is replaced by the corpus with an explanation. Everything else works from RECORDED data.
