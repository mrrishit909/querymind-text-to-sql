# Scroll storyboard (approved)

## Structure

The site runs **Intro (10.2 s, time-based) → Hero → seven scroll beats.** The band (the gauntlet) is sticky from Hero through Beat 6.

| Beat | Mandated area | Desktop scroll length | Band query |
|---|---|---|---|
| Intro → Hero | intro | 1 viewport | Q1 |
| 1 Ask | **Question Explorer** and **SQL Inspector** | 200vh (2 sub-steps) | the selected question (default Q1) |
| 2 Shape | **Result Visualization** | 150vh | the selected question's rows |
| 3 Build | **Visual Query Builder** | 150vh, then pinned while interacted with | compiled SQL |
| 4 Judge | **Security Demonstrations** (6 demos, Console, corpus) | 250vh (3 sub-steps), pinned while the Console has focus | the selected demo or typed SQL |
| 5 Breach | security, the incident | 200vh (3 sub-steps) | the recorded pg_roles attack |
| 6 Depth | security, layers 2–5 | 120vh | Q1, continuing past G11 |
| 7 Ledger | colophon | natural height | the band un-sticks |

**Shared rules:**

- The visitor can interact with the band in every beat. Scroll sets the *default* query, and any click overrides it until the next beat boundary.
- Every beat has an `id` and is reachable from the top bar, so the site is usable without scrolling.

**Data loading at frame 0:**

- Fetch these fixtures in parallel:
  - `questions.json`
  - `security_demos.json`
  - `schema_catalog.json`
  - `query_builder_grid.json`
  - `attack_corpus.json` (new; see `interaction-map.md`)
  - `breach_evidence.json` (new: the 3 recorded `/execute` responses, parsed from `artifacts/verification/schema_qualified_cte_bypass_live_api.txt`)
- Start the **validator worker**: Pyodide, then pinned `sqlglot-30.21.0` wheel served from `site/public/py/`, then `sql_validator.py` (current), `sql_validator_before.py` (reconstructed) and the stub `db/connection.py`.
- The ledger reads `validator · loading {pct}%` → `importing sqlglot` → `parity {k}/{n}` → `LIVE · sha f014977c` (or `parity FAILED · recorded verdicts only`).

**Proof run (as soon as the worker is ready, in the background):**

1. Validate Claude's 10 SQL strings from `questions.json`, and the full corpus under both validator versions.
2. Compare the results with the recorded verdicts *and* reason strings.
3. The Explorer shows a lime LIVE tick next to each question once its SQL has been re-judged live and matched.

LIVE status is earned, never assumed.

---

## Intro (time-based, 10.2 s, skippable)

Uses Q1 (`questions.json[0]`).

| t (s) | What happens |
|---|---|
| 0.0–1.4 | Obsidian. Q1 types in, set in Newsreader 56/64 silver, at 32 ms per character, in the left two-thirds at mid-height. **Skip** is at the top right. The ledger reads `validator · loading`. |
| 1.4–2.6 | Phrases underline in sequence, about 180 ms apart, as described in the phrase-link table below. Derived links get a solid cobalt-ink underline. Annotation links get a dotted silver-dim underline. A legend fades in at the bottom left: `── derived from the SQL · ┄ annotation`. |
| 2.6–3.8 | The underlined phrases lift by 24 px and separate horizontally into 5 groups. Each group crossfades from serif to Martian Mono at `wdth` 112, cobalt-ink, `dur.crossfade`. The un-underlined words ("Which", "the", "from") fade to 0. |
| 3.8–5.2 | Each group compresses (`wdth` 112 → 87, `dur.width`) and **rewrites as its clause** from the real SQL. The clauses then stack into one slug in the language zone, in true SQL order: `SELECT … FROM … JOIN … WHERE … GROUP BY … ORDER BY … LIMIT 3`. |
| 5.2–6.4 | The gates draw on, top to bottom, staggered 30 ms (the LLM gate, then G1–G11). The slug travels through them (`ease.travel`), and each gate ticks lime. At G11 the slug re-sets at `wdth` 75 as the regenerated SQL. If the worker has already returned Q1's verdict, the ledger dot pulses LIVE. Otherwise it reads `recorded verdict · validated`. |
| 6.4–7.6 | The slug dissolves into a table header in the data zone (`category · revenue`). Three real rows land: `Outdoors 129,055.12`, `Office 97,560.51`, `Electronics 86,011.18`. |
| 7.6–8.8 | The table morphs to horizontal bars (see `motion-bible.md` "Table → bar"). Bar widths are proportional to the real values. |
| 8.8–10.2 | The bars dock into the Inspector's result slot on the lower deck. The Explorer strip fades in on the upper deck with Q1 selected. The display claim sets in the upper-deck left: **"Only what survives the gauntlet runs."** It is followed by a caption: "Twelve real questions. Every SQL string Claude wrote is judged again, here, by the production validator." |

**Phrase links** (computed at runtime by deterministic matching, not stored):

| Phrase | Link | How it is found |
|---|---|---|
| `3` | `LIMIT 3` | numeric literal equal to a question token |
| `product categories` | `p.category`, `v_products` | token stem (`categor`, `product`) is a substring of a column or view identifier |
| `revenue` | `AS revenue` → `SUM(oi.quantity * oi.unit_price)` | token equals a column alias |
| `completed orders` | `o.status = 'completed'`, `v_orders` | token equals a string literal; stem `order` matches a view |
| `most` | `ORDER BY revenue DESC` | **annotation** (not string-derivable) |

**Matching rule:**

1. Lowercase both sides.
2. Strip a plural `s` and `ies` → `y`.
3. Match against: view names minus `v_`; column names and aliases from the regenerated SQL; string and numeric literals.

The same rule powers the Inspector's question-to-SQL highlighting for all 10 answered questions. Anything not matched is shown unlinked, or as an annotation if the copy calls it out.

**Skip:** jump to the 10.2 s end state.

**Reduced motion:** four static frames, 1.2 s each, 120 ms crossfade, advance on any key:

1. the question with underlines;
2. the 5 clauses;
3. the slug past G11 with the table;
4. the Hero.

**Return visits:** `sessionStorage['querymind.introSeen']` auto-skips, inside try/catch. "Replay intro" is in the ledger bar.

---

## Hero

This is the end state of the intro. The display claim is shown, the Explorer strip sits on the upper deck, Q1 is in the band (passed, rows in the data zone), and the Inspector is on the lower deck. A scroll cue (a `↓` and the text "Ask") sits at the bottom center.

## Beat 1 · Ask: "Twelve real questions."

**Sub-step 1a: Explorer.**

- The upper deck expands to 6 category columns: Revenue, Customers, Products, Retention, Operations, Security. Each holds 2 questions in Newsreader 20/28.
- Each question carries tags:
  - `validated` (lime), or `declined by Claude` (silver-dim) for the 2 Security questions;
  - a LIVE tick once the proof run matches.
- **Selecting a question** runs the canonical verdict animation for it.
- **Security questions** play the LLM-decline variant. Claude's real decline text appears at the dashed LLM gate, and the caption reads: "Claude refused. The validator never had to decide. It would have: see Judge."

**Sub-step 1b: Inspector.** The lower deck grows to full Inspector. Contents:

- the original question;
- stored SQL (RECORDED, already backend-regenerated) and the LIVE re-regeneration, with a gutter proving they are identical;
- approved views (5, with the referenced ones lit);
- the real AST tree;
- the result table, plus the visualization thumbnail;
- assumptions (Claude's real text);
- cost (`$0.004544`, RECORDED).

Caption: "Claude only saw these five views. The validator only allows these five views. The database role can only read these five views."

## Beat 2 · Shape: "Rows become pictures, and stay rows."

- The data zone widens to columns 7–12. Its toggle reads `table · bar · line`.
- The default is the selected question's rows. Bar is the default when there are 2 or more rows with one numeric column.
- **Line** is enabled only for an ordered dimension. That needs the new monthly fixture; see `interaction-map.md`. The visitor can switch to "Monthly completed revenue" in this beat's own picker once it exists.
- **Single-value answers** (Q2 `375.55`, Q6 `20`, Q7 `0.0685`, Q10 `4.91`) are shown as one large mono number with the column name. The caption reads: "One row, one number. A chart would only decorate it."
- **Q8** reads `50 of 189 rows shown · fixture cap`.

## Beat 3 · Build: "Compose a question without words."

- The upper deck shows chip rows for dimension, measure, status filter and sort.
- **Every change re-runs the pipeline:**
  1. A deterministic template compiles the chips to SQL. It is shown in the slug.
  2. The SQL is sent to the **LIVE validator** and travels the gates.
  3. The result is looked up in the precomputed grid by key.
- **On a grid hit:** the rows land, RECORDED, with the caption `executed against Postgres as querymind_reader at fixture time`.
- **On a miss:** the data zone shows `not precomputed`, with no fake rows.
- **The builder never offers a combination the grid lacks**, so a miss appears only if the grid and the UI drift. A dev-mode assertion catches that.

## Beat 4 · Judge: "Try to break it."

- **4a: Six demos.** Six demo cards sit in an upper-deck strip. Selecting one sends its SQL through. The verdicts are LIVE, with the RECORDED reason shown beside them for comparison.
  - The approved SELECT lands its 8 real rows.
  - DELETE and DROP stop at G3.
  - `customers` stops at G9.
  - The multi-statement injection stops at G2.
  - The catalog-leak demo stops at G9. A small link reads "this one used to get through →", which jumps to Beat 5.
- **4b: Console.** The lower deck becomes the console:
  - a single mono input, 3 lines tall, with a restore-example button;
  - the AST below it;
  - the verdict inline.
  The band follows every keystroke. The version switch (`current` / `before fix · reconstructed`) sits beside the input.
- **4c: Corpus matrix.** The data zone and lower deck show the corpus as a matrix of about 40 rows × 11 gate columns, aligned to the gates' x positions.
  - Filter chips select by gate and by "diverges before/after".
  - Clicking a row loads it into the Console.
  - Flipping the version switch re-judges every row LIVE.
  - Divergent rows are outlined using the three-way split in `colors.md` rule 3:
    - breach-red only for `pg_catalog` / `information_schema` references;
    - silver for other qualified tables;
    - silver-dim for G7.
  - Of the 7 recorded pre-fix cases, 4 are breach-red, 1 is silver (`public.customers`) and 2 are silver-dim (window, `||`).

## Beat 5 · Breach: "On 2026-10-08, one gate had a hole."

This beat is framed as an exhibit (graft from Concept C). Margin citation: `REQUIREMENTS_AUDIT.md · Independent Verification Pass`.

- **5a: The attack.** The version switch is forced to `before · reconstructed`, and the hatch is visible.
  - The attack slug travels at half speed. G9 opens and the slug crosses.
  - The 18 EVIDENCE rows land, cited `artifacts/verification/schema_qualified_cte_bypass_live_api.txt`.
  - `postgres · rolsuper true` is outlined in breach-red.
  - A tab strip offers the other 2 recorded attacks: `information_schema.tables` (196 rows, shown as a scrolling column) and `pg_stat_activity` (6 rows, with `client_addr` shown as recorded).
  - Caption: "The validator saw a CTE named `pg_roles` and decided `pg_catalog.pg_roles` meant the CTE. It never checked the schema prefix."
- **5b: The root cause.** The lower deck shows the real 3-hunk diff, before against current:
  - `if name in defined_so_far:` → `if _is_unqualified(table) and name in defined_so_far:` (×2);
  - the added `exp.Window` / `exp.DPipe` block.
  Each hunk aligns under the gate it changed (G9, G9, G7). The AST shows the `Table` node with `db=pg_catalog` lit. That is the field the old code ignored.
- **5c: The fix, triggered by the visitor.** A large switch reads **"Apply the fix"**. On click, G9 knits closed and the slug re-runs and stops at G9. The rows vanish, replaced by `0 rows`.
  - The control case appears below. `WITH customers AS (SELECT * FROM v_customers) SELECT * FROM public.customers` was *also* accepted by the old validator, but the database role stopped it (`permission denied for table customers`, EVIDENCE).
  - Caption: "Defense in depth caught that one. It could not catch `pg_roles`: catalog views are world-readable."
  - Closing line: "Found, confirmed live, fixed, and re-verified against a rebuilt container, all the same day."

## Beat 6 · Depth: "The validator is layer one of five."

- The depth gates brighten, and Q1's slug continues past G11 through them, RECORDED.
- Each gate gets one lower-deck card, holding the claim, the proof test name, and the evidence file:

| Layer | Proof |
|---|---|
| Read-only transaction | `db/connection.py` |
| Role grants (5 views only) | `test_direct_select_on_base_table_rejected_by_grants` |
| RLS on base tables | `test_rls_blocks_even_with_an_accidental_grant` |
| `statement_timeout` 3 s | `test_statement_timeout_fires_on_a_validator_accepted_slow_query` |

- **Honest nuance card.** "A role can lower its own timeout with `SET statement_timeout = 0`. Through this app it can't, because the validator rejects any `SET` at G3." Evidence: `artifacts/verification/timeout_override_attempt.txt`. The visitor can type `SET statement_timeout = 0` into the console to see it stop at G3, LIVE.

## Beat 7 · Ledger

The band un-sticks. A colophon in a 3-column mono table:

- **Questions:** 12 · validated 10 · declined by Claude 2.
- **Claude calls:** 12 · total `$0.049`. Model read from the fixture.
- **Validator:** `sql_validator.py` sha `f014977c…` · sqlglot 30.21.0 · Pyodide {version} · parity {k}/{n}.
- **Tests:** 87 passed, 2 skipped (audit).
- Links: source repo, `REQUIREMENTS_AUDIT.md`, `LIMITATIONS.md`.
- A "Replay intro" link.
