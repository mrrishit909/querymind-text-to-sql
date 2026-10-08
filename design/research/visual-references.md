# QUERYMIND visual references

This research was done on 2026-10-08. Every URL below came back from a real search or fetch in this session. Where I could not open a page myself, I say so and note which descriptions I relied on.

**The bar to clear.** PREDICTIVE (`~/predictive-ml-lab/design/concepts/concept-a.md`, "TERRAIN") is the bar. Its standout move was running the *real* model (ONNX in a worker) on every interaction, so that the main visual was the model's own output and not an illustration. QUERYMIND's version of that move is this:

> **The real `sql_validator.py`, byte-identical, judges SQL that the visitor writes, in the browser.**

The references below were chosen to serve that move.

---

## 1. Visual composition: Ryoji Ikeda, *test pattern* / *data.tron*

- **URLs**
  - https://vernissage.tv/2013/08/26/ryoji-ikeda-test-pattern-100-m-version-ruhrtriennale-arts-festival-2013/
  - https://www.e-flux.com/announcements/39634/ryoji-ikeda-datamatics
  - https://carriageworks.com.au/?p=2246
- **What it is.**
  - Ikeda's system converts any data (text, sound, images) into barcode and binary patterns, and projects them across a 30 to 100 m floor.
  - The palette is close to absolute: black, white and a hairline.
  - The scale is monumental, and the visitor stands *inside* the data.
- **What I learned.**
  1. Data at maximal contrast on black reads as *material*, not as a chart.
  2. A single horizontal axis with the full viewport height becomes architecture. The viewer reads it as a corridor, not a graph.
  3. Rigor (exact pixel rules, no ornament) is itself the aesthetic.
- **How QUERYMIND differs.**
  - Ikeda's data is *illegible by design*. It is texture.
  - QUERYMIND keeps the obsidian field and the hairline discipline, but every mark is *legible and inspectable*. A gate line is a real check in `validate_sql()`. A block is a real AST node. A row is a real executed row.
  - We borrow the corridor-as-architecture idea, never the noise. Nothing on the page flickers for texture. The only motion is a query moving through checks.

## 2. Visual composition: Bloomberg, *What's Really Warming the World?* (2015)

- **URL:** https://www.bloomberg.com/graphics/2015-whats-warming-the-world/
- **Sources.** I could not open the Bloomberg page directly. These notes rely on:
  - https://climate.gov/teaching/resources/whats-really-warming-the-world-29366
  - https://shortyawards.com/8th/whats-really-warming-the-world
- **What it is.**
  - One persistent chart: the observed temperature line.
  - Scroll brings in candidate explanations one at a time, and each is tested *against the same line*.
  - Only one candidate fits.
  - The argument is made by *elimination on a fixed frame*.
- **What I learned.**
  - A single fixed frame that every candidate is tested against is more persuasive than a sequence of separate charts.
  - The viewer learns the frame once and then watches each candidate fail or pass.
- **How QUERYMIND differs.**
  - Our fixed frame is the **gauntlet**: the 11 ordered checks of the real validator, drawn as vertical gates.
  - Every query passes through the same frame: Claude's 10 SQL strings, the builder's compiled SQL, the 6 security demos, the attack corpus, and the visitor's own typing.
  - Bloomberg's candidates were authored by the newsroom. Ours can be authored by the reader, and the verdict is computed live by the production code.
  - Bloomberg tests *data against a model*. We test *input against a defense*, and we show the day the defense lost.

## 3. Interaction / motion: Bret Victor, *Up and Down the Ladder of Abstraction* (2011)

- **URL:** http://worrydream.com/LadderOfAbstraction/
- **Sources.** These notes are paraphrased from:
  - https://waxy.org/2011/10/bret_victors_up/
  - https://nohn.bearblog.dev/victors-up-and-down-the-ladder-of-abstraction/
  - https://arxiv.org/pdf/2208.12981
- **What it is.**
  - It starts from one concrete run of a system (a car on a road).
  - It then abstracts over time (the whole trajectory as one line), then over a parameter (a family of trajectories).
  - The reader steps up and down between the concrete case and the abstract view.
- **What I learned.**
  - Our site needs three rungs:
    1. **one query**: one sentence becomes one SQL statement, then one verdict;
    2. **all queries**: the attack corpus as a matrix of cases × gates;
    3. **all versions**: the same corpus judged by the validator before and after the 2026-10-08 fix.
  - Victor's rule is that every abstract view must link back to a concrete instance you can touch.
- **How QUERYMIND differs.**
  - Victor's ladder abstracts over a *continuous parameter*. Ours abstracts over *adversarial inputs and code versions*.
  - The top rung is a version toggle: `validator: current · before fix`. It is a real diff of real code, and it re-judges the whole corpus at once.
  - Victor's example simulates a toy system. Ours runs the production file.

## 4. Interaction / motion: Bartosz Ciechanowski's interactive explainers

- **URLs**
  - https://ciechanow.ski/ (fetched in this session; the current lead article is "Moon")
  - Description of his practice: https://unsung.aresluna.org/three-good-interactive-explainers/
- **What it is.**
  - Long-form explainers where *every* figure is directly manipulable.
  - Ideas are color-coded consistently between prose and figures. A word in the text and the matching part of the figure share a hue.
  - Readers can undo their changes.
- **What I learned.**
  1. Color is a *binding* between prose and figure, not a decoration. Our three semantic hues map that way:
     - cobalt is structure (SQL and the AST);
     - lime is data (rows and passes);
     - silver is human language.
     The same word in the caption and in the SQL carries the same hue.
  2. Every figure gets a reset affordance. The console gets `restore example`, and the builder gets `reset`.
  3. Motion is used only to show *a change of state*.
- **How QUERYMIND differs.**
  - Ciechanowski's figures are hand-built simulations of physical systems.
  - Our figures are outputs of the actual production code (the sqlglot AST and the validator verdict), so the binding between prose and figure is to *real* objects.

## 5. Typography / editorial: Martian Mono (Evil Martians), with Instrument Sans

- **URLs**
  - https://evilmartians.com/products/martian-mono
  - https://fonts.google.com/specimen/Martian+Mono/about
  - https://cdn.jsdelivr.net/gh/evilmartians/mono@main/README.md
  - Companion: https://github.com/Instrument/instrument-sans
- **What it is.**
  - Martian Mono is a variable monospace, released under SIL OFL (verified in this session).
  - It has a **width axis**: the README gives Condensed 75% up to about 112.5%; Google Fonts says "Condensed to SemiExpanded"; and the sources disagree on the top end. The engineer must read the axis range from the served file.
  - It also has a weight axis, Thin to ExtraBold.
  - Instrument Sans is OFL, variable, with `wdth` 75–100 and `wght` 400–700.
- **What I learned.**
  - A width axis on a monospace is a *transformation verb*.
    - A loose, wide token can **compress** into a dense clause.
    - That is exactly the mandated intro move, where words separate into groups and the groups become SQL clauses.
  - We can animate `font-variation-settings: "wdth"` with the Web Animations API. It is a real typographic change, with no morphing tricks and no canvas text.
- **How QUERYMIND differs.**
  - Editorial sites use variable fonts for optical polish.
  - We use width *semantically*:
    - natural language is set wide and loose (Newsreader serif, then tokens in Martian Mono at 112);
    - validated SQL is set condensed and locked (Martian Mono at 75–87).
  - The physical width of text encodes how "structured" it is.
- **Not used.** A style catalog says Stripe Press sets its type in Ivar (https://styles.refero.design/style/54f257e9-1d6b-4410-b94a-1dfe648ecc87). Ivar is a commercial family. It is noted here only as an example of book-spine editorial stacking, and it is not a font we will ship.

## 6. Domain: SQL / database / security visualization

### 6a. PEV2 / explain.dalibo.com, a Postgres plan visualizer

- **URLs**
  - https://explain.dalibo.com/about
  - https://pgmustard.com/blog/postgres-query-plan-visualization-tools
- **What it is.**
  - It turns `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` output into a node tree.
  - It highlights the costliest nodes.
  - It is a ground-up rewrite of Alex Tatiyants' PEV.
- **What I learned.**
  - Database people trust a tree when every node maps 1:1 to the engine's own output, and when the *one node that matters* is highlighted rather than everything at once.
- **How QUERYMIND differs.**
  - PEV2 visualizes the *planner's* tree after the database accepted the query.
  - We visualize the *parser's* tree (sqlglot's real AST) **before** the database ever sees it, at the moment of judgment.
  - Our highlighted node is not the slow one. It is the node that made the validator say no. For the breach, it is the `Table(db=pg_catalog, this=pg_roles)` node whose `db` qualifier the old validator ignored.

### 6b. AST Explorer (astexplorer.net)

- **URLs**
  - https://github.com/fkling/astexplorer (upstream, per https://best-of-web.builder.io/library/fkling/astexplorer)
  - https://egghead.io/lessons/javascript-use-astexplorer-net
- **What it is.**
  - You paste code and see the AST from a chosen parser.
  - Clicking code jumps to the node.
  - Different parsers give different trees.
- **What I learned.** That last point, *different parsers produce different trees*, is the core argument of our biggest technical decision (§7). A JS re-implementation of the validator would judge a *different tree* from the one production judges.
- **How QUERYMIND differs.**
  - AST Explorer is a developer tool with a split-pane, form-like UI.
  - We render the tree as a *structure the query physically passes through*, and only at the scale of one query (5–40 nodes). It is never a raw JSON dump.

---

## 7. Technical research: can the real validator run in the browser?

The commission asked for this to be investigated seriously. These were the options.

| Option | What it is | Verdict |
|---|---|---|
| **node-sql-parser** (https://redirect.github.com/taozhi8833998/node-sql-parser, mirror README https://cdn.jsdelivr.net/npm/@darz-io/node-sql-parser@5.0.0/README.md) | PEG parser with a Postgres grammar. The PG-only UMD bundle is about 150 KB. | **Rejected as the judge.** Its AST is not sqlglot's AST. Porting the allowlist means re-deciding, by hand, what counts as `exp.Anonymous`, `exp.Window`, `exp.DPipe`, a schema-qualified `Table`, and so on. Every divergence is a place where the site would show a verdict the backend would not give. The 2026-10-08 bypass lived in exactly that kind of detail (`table.db`). A port is a simulation with extra steps. |
| **sql-parser-cst** (https://www.npmjs.org/package/sql-parser-cst) | A CST parser by Rene Saarsoo. Its Postgres support is **experimental** (per its README). | **Rejected.** Same divergence problem, and the dialect is not stable. |
| **Pyodide + sqlglot 30.21.0 + the unmodified `sql_validator.py`** (https://pyodide.org/en/stable/project/roadmap.html, https://blog.pyodide.org/posts/0.23-release/) | CPython compiled to WebAssembly. Any pure-Python wheel loads into it. | **CHOSEN.** See the evidence below. |
| PGlite (Postgres compiled to WASM) for execution | Would let the builder run arbitrary SQL in the browser. | **Rejected.** It would be a *copy* of the data without the production role, RLS, grants or timeout. That makes it a weaker truth claim than results precomputed against the real `querymind_reader` role. The builder's space is finite, so precomputing covers it exactly. |

**Evidence gathered in this session** (scratch probe only, not committed):

1. **sqlglot is pure Python.**
   - `venv/lib/python3.12/site-packages/sqlglot` holds 5.1 MB of source.
   - `find … -name "*.so"` returned nothing.
   - The optional Rust tokenizer `sqlglotrs` is not installed.
   - So it can load in Pyodide. This is to be confirmed in-browser by the frontend engineer.
2. **`sql_validator.py` has one non-portable import**: `from db.connection import APPROVED_VIEWS`. `db/connection.py` imports psycopg2.
   - A stub `db/connection.py` that holds only the 5-view set was enough for the unmodified validator to run.
   - SHA-256 of the shipped validator: `f014977c61444811b046b652bea7ee9e6764ab70635d0212d3d06f793fffc50d`.
3. **A pre-fix validator can be reconstructed and checked against recorded evidence.**
   - Reverting the three hunks documented in `REQUIREMENTS_AUDIT.md`'s follow-up gives the pre-fix version. The three hunks are:
     - the `_is_unqualified(table) and` condition, in both places;
     - the `exp.Window` / `exp.DPipe` rejection block.
   - The reconstruction **ACCEPTS all 5 cases** recorded in `artifacts/verification/schema_qualified_cte_bypass.txt`.
   - It also accepts `COUNT(*) OVER (...)` and `||`. The audit says both validated live before the fix.
   - The current file **REJECTS all 7**.
   - Both versions reject the *unqualified* `WITH pg_tables AS (SELECT * FROM pg_tables) …` shadow. That one was fixed earlier, which also matches the audit.
4. **The line chart's data source is legal.** `SELECT DATE_TRUNC('month', order_date) …` is ACCEPTED by the current validator, so a real monthly time series can be added to the fixtures.

**Cost:**

- Pyodide's first load is about 6.4 MB per its roadmap, or 5.3–6.9 MB Brotli per the 0.23 release notes. Init took 0.5–1.3 s on a fast connection in the 0.23 benchmark, and 4–5 s in older figures.
- PREDICTIVE shipped a ~14 MB onnxruntime wasm, so this is a smaller payload for a stronger claim.

**Decision:**

- **Live, byte-identical validator in a Web Worker is the primary path.**
- A **precomputed attack corpus** is generated by the real Python validator (both versions) at fixture time. It serves three purposes:
  1. the browsable library;
  2. the **parity suite** the browser must pass before it calls itself LIVE;
  3. the full fallback when WASM is unavailable or not yet loaded.
