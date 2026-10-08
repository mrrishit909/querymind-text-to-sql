# Concept A: GAUNTLET

## Visual thesis

The validator is a physical place, and every query has to walk through it.

The site is built around one fixed frame, **the gauntlet**: 11 vertical hairline gates spanning the full viewport height. Each gate is one real check in `validate_sql()`, in the order the source code runs them.

| # | Gate | Fires when (real reason-string prefix) |
|---|---|---|
| G1 | PARSE | `SQL did not parse` / `empty SQL` |
| G2 | ONE STATEMENT | `expected exactly 1 statement` |
| G3 | SELECT ROOT | `only SELECT/CTE statements are allowed` |
| G4 | NO WRITE NODE, ANYWHERE | `disallowed statement type in query` |
| G5 | NO INTO · NO LOCK | `SELECT ... INTO` / `FOR UPDATE/FOR SHARE` |
| G6 | FUNCTION ALLOWLIST (14 classes) | `disallowed function` |
| G7 | NO WINDOW · NO `\|\|` | `window functions` / `the \|\| concatenation` |
| G8 | WITH SHAPE | `nested WITH` / `WITH RECURSIVE` |
| G9 | TABLE SCOPE | `unapproved table/view referenced` |
| G10 | NON-EMPTY | `query references no table` |
| G11 | REGENERATE | accepted, and `stmt.sql()` is now the string that will run |

**How a query moves through it:**

- **Left of the gauntlet is language.** It is cobalt and silver: the question set in serif, then tokens, then clauses.
- **Right of the gauntlet is data.** It is lime: the rows and the chart.
- A query is a typeset slug of SQL clauses. It enters from the left and travels gate by gate.
  - If it passes, it crosses G11. There it is **re-typeset from the AST**, so the visitor sees that the string that runs is the AST's output, not the input text. Then it becomes rows.
  - If it is rejected, it stops dead at the gate that fired. The offending AST node lifts out of the slug and hangs on the gate with the real reason string.

**What runs where:**

- **Everything goes through the same frame:** Claude's 10 real SQL strings, the 2 LLM declines (they never reach G1, and they stop at a gate drawn *before* the gauntlet, labeled `LLM`), the builder's compiled SQL, the 6 security demos, a corpus of about 40 recorded attacks, and **SQL the visitor types themselves**.
- The verdicts are computed **live, in-browser**, by the byte-identical `sql_validator.py` running on Pyodide in a worker.

**The climax: THE BREACH.**

- G9 is shown as it was on the morning of **2026-10-08**. It had a bare-name slot that let a CTE called `pg_roles` vouch for `pg_catalog.pg_roles`.
- The recorded attack walks through every gate, turns lime, and pours out the **real 18 leaked rows**, including `postgres · rolsuper true`.
- The visitor then flips the validator version. G9 is rebuilt, the same query hits it and stops, and the hole closes.

## Palette

These are the 5 mandatory colors, plus 2 text-safe derivatives and 1 single-use extension.

| Token | Hex | Role |
|---|---|---|
| obsidian | `#0D1015` | the field |
| silver | `#DCE1E6` | human language, body text, gate hairlines at 28% |
| cobalt | `#416CFF` | structure: SQL clauses, AST nodes, gate labels (large/stroke only, 4.37:1) |
| lime | `#C1F46D` | data and passage: rows, chart marks, "crossed G11", the LIVE dot |
| slate | `#25313B` | surfaces, rejected slugs, inactive gates |
| cobalt-ink (derived) | `#7F9BFF` | cobalt for small text (7.29:1) |
| silver-dim (derived) | `#8B96A1` | metadata (6.33:1) |
| breach (extension) | `#FF5C4D` | **only** the gate that failed historically and its leaked rows (6.25:1) |

**The rule.** A rejection is *success* (the gate held), so it is never red. Red exists for exactly one event in the whole site: the day a gate failed.

## Typography

- **Newsreader** (Google Fonts, OFL, `opsz` 6–72): natural-language questions only. The human voice is set in serif.
- **Martian Mono** (OFL, `wdth` 75–112.5, `wght` 100–800): SQL, AST, reasons, every number.
  - Width encodes how structured the text is:
    - 112 for loose tokens;
    - 87 for clauses;
    - 75 for the regenerated, validated SQL.
- **Instrument Sans** (OFL, `wdth` 75–100, `wght` 400–700): claims, headings, UI.

## Layout strategy

- **1440 px.** The gauntlet band is sticky and spans 100 vw at mid-height.
  - The left third is the language zone, the middle third holds the 11 gates, and the right third is the data zone.
  - Scroll beats change what enters the band.
  - Panels (Explorer, Inspector, Console) dock *above and below* the band, never on top of it.
- **390 px.** The corridor rotates to vertical. Language is at the top, gates are horizontal notches down a left spine, and data is at the bottom. Scrolling *is* traversal.

## Opening storyboard (~10.2 s)

Uses the real Q1: "Which 3 product categories generate the most revenue from completed orders?"

1. **0.0–1.4 s.** On obsidian, the question types in Newsreader 56 px, silver. **Skip** is at the top right from frame 0. The engine ledger at the bottom left reads `validator · loading`.
2. **1.4–2.6 s.** Phrases highlight in order: `3` · `product categories` · `revenue` · `completed orders` · `most`. Solid underlines mark *derived* links, found by a deterministic match against identifiers and literals in the real SQL. A dotted underline marks *annotation*: `most` → `DESC` cannot be string-matched, so it is labeled as editorial.
3. **2.6–3.8 s.** The words lift and separate into 5 groups. They re-set from serif into Martian Mono `wdth 112`, cobalt-ink.
4. **3.8–5.2 s.** Each group compresses (`wdth 112 → 87`) and *becomes its clause*: `SELECT p.category, ROUND(SUM(…))` · `FROM v_order_items JOIN …` · `WHERE o.status = 'completed'` · `GROUP BY` · `ORDER BY revenue DESC` · `LIMIT 3`. The clauses stack into one slug.
5. **5.2–6.4 s.** The 11 gates draw top to bottom as silver hairlines. The slug crosses them, and each gate ticks lime as it is passed.
   - If Pyodide is ready, this is a LIVE verdict and the dot pulses.
   - If not, it replays the RECORDED `validated` status, labeled as such.
   - At G11 the slug re-sets at `wdth 75`. This is the regenerated SQL.
6. **6.4–7.6 s.** A result table assembles to the right of G11: the header, then 3 real rows (Outdoors 129,055.12 · Office 97,560.51 · Electronics 86,011.18) in lime.
7. **7.6–8.8 s.** The rows extrude into 3 horizontal bars. Bar length is the real revenue.
8. **8.8–10.2 s.** The bars dock into the Inspector's visualization slot. The gauntlet settles at mid-height, and the Explorer fades in above with Q1 selected. The display claim sets: "Ask anything. Only what survives the gauntlet runs."

**Reduced motion:** four static frames crossfade:

1. the question with highlights;
2. the clauses;
3. the slug past G11 with the table;
4. the docked hero.

## Motion grammar

- **Travel is linear and constant.** About 1.6 gates per 100 ms. A query moves like an object on a conveyor, never with springy flourishes.
- **Stops are hard.** A rejected slug decelerates over 90 ms and stops 8 px before the gate. The gate flares to full silver for 200 ms.
- **Width animation is the transformation verb.** No glyph ever morphs.
- **Nothing moves unless a verdict, a selection or a scroll beat changed.**

## Primary interaction: "Try to break it"

- A console sits below the gauntlet. Every keystroke (debounced 120 ms) sends the text to the worker. The real validator judges it, and the slug moves to the gate that fired.
- The real sqlglot AST renders beneath the slug, with the offending node lit.
- **Version switch** (`current · sha f014977c` / `before 2026-10-08 · reconstructed`): this re-judges the typed SQL *and* the whole corpus matrix.
- **Accepted means accepted, not executed.** The label reads `ACCEPTED · would run as querymind_reader · not executed: this is a static site`.
  - Rows are shown only when the regenerated SQL exactly matches a recorded execution: one of the 12 questions, the 6 demos, the builder grid, or the 3 recorded breach queries.

## Technical approach

- React 19 + Vite, which is already in `site/`.
- **Pyodide** loads in a Web Worker from intro frame 0. sqlglot 30.21.0 is pinned and served locally. The unmodified `sql_validator.py` and a stub `db/connection.py` holding `APPROVED_VIEWS` are also loaded.
  - The worker returns `{ok, reason, referenced_views, sql}` plus a serialized `stmt.walk()` tree. The tree comes from sqlglot itself, not from a re-parse.
- The gauntlet and slugs are DOM text with WAAPI/FLIP. The gates and the AST are SVG. There is no WebGL, because nothing here needs a GPU.
- **Parity suite.** The corpus is run in the browser on load and compared with the Python verdicts (verdict *and* reason string). LIVE status is earned only at 100%.

## Performance risk

- **Pyodide cold start.** The download is about 6–7 MB. Init plus the first `import sqlglot` can take 2–5 s on mid-range phones.
- **Mitigation:**
  - Start the worker at frame 0.
  - The intro never blocks on it; it uses the recorded fallback.
  - At 390 px, load only when the console is opened.
  - Keep the corpus and recorded verdicts usable with zero WASM.
