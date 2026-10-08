# Concept selection

**Winner: Concept A, GAUNTLET.**

It carries two grafts from the losing concepts:

- **From C (CASE FILE):** the dated *exhibit* framing and the provenance stamps for the Breach beat, plus the file-path citations in the margin.
- **From B (CANOPY):** the real sqlglot AST, drawn as a small tidy tree under the slug in the Inspector and the Console. It appears only at single-query scale, never as a forest.

## Scoring

Each criterion is scored 0–5. The first two are gating: a 0 on either disqualifies the concept.

| # | Criterion | A GAUNTLET | B CANOPY | C CASE FILE |
|---|---|---|---|---|
| R | **Hard rejection condition.** Is it plainly *not* a chatbot with bubbles, and is the identity the transformation of language into structured data? | **5.** The left-to-right band *is* language → structure → judgment → data. There is no message turn anywhere. | **5.** It is trees, not bubbles. The transformation is visible, but it is language → *tree* more than language → *data*. | **3.** Not a chatbot, but the identity is "a document". The transformation lives inside small figures, so it risks reading as a blog with code blocks. |
| M1 | **Does the real validator and security story feel like the main event?** | **5.** The validator is the architecture of the page. Every query of every kind visibly walks its 11 real checks. The Breach shows the actual gate that failed. | **4.** Pruning is vivid. But the validator itself (*which* check, in *what order*) is invisible, and it is just "the tree got cut". | **4.** It is the clearest *telling* of the incident. But it tells more than it shows: the validator is prose plus a stamp. |
| M2 | **Does the real SQL-generation pipeline feel like the main event?** It must not be eclipsed by security. | **5.** The intro and Beat 1 run Claude's 10 real SQL strings through the same gates *live* (a "proof run"). The 2 LLM declines stop at a visible `LLM` gate *before* G1. That is a separate layer, shown as separate. | **4.** The grove of 12 is beautiful. But question → SQL is lost in node glyphs, and SQL text appears only on hover. | **3.** The pipeline is an exhibit. Security is the plot. |
| 4 | Mandated intro fidelity: question → highlights → groups → clauses → table → rows → chart → interface | **5.** Every mandated step, plus the gauntlet pass at 5.2 s, which is the identity. | 4. "Clauses" become stems, and the table is beads. It is a loose reading. | 4. Faithful, but small and in-column. |
| 5 | All 5 mandatory areas as first-class | 5 | 3. The builder as "grafting" is charming but slow to use. Tables are hard to read in WebGL. | 5 |
| 6 | Honesty and provenance legibility | 5 | 3. Abstraction hides *which* data is real. | 5 |
| 7 | Mobile (390 px) and accessibility | 4. The corridor rotates to a vertical spine. | 2. Canvas core, touch hit-testing, and a mandatory parallel DOM. | 5 |
| 8 | Build risk | 4. Pyodide plus DOM/SVG; the risk is known and mitigated. | 2. WebGL plus Pyodide plus camera. | 5 |
| 9 | "Statement piece" memorability | **5.** "I typed an attack, watched it walk the real gates, then flipped to the old validator and watched it walk *through*." | 5 | 3 |
| | **Total** | **43** | **32** | **37** |

## Why A clears a higher bar than PREDICTIVE's TERRAIN

TERRAIN's breakthrough was that every pixel of the hero was a live inference from the real model. GAUNTLET keeps that standard and raises it on four axes.

1. **The input space is unbounded and visitor-authored.**
   - In TERRAIN, the visitor moved a customer inside a 2D slice the designer chose.
   - In GAUNTLET, the visitor writes arbitrary SQL. That is an infinite, adversarial input space, and the production code judges it.
   - The visitor is not exploring a model. They are **attacking a system**.
2. **The truth claim is stronger: byte-identical, not "within 1e-4".**
   - TERRAIN's honest parity claim was "matches scikit-learn within 1e-4 on 398 of 400 rows".
   - GAUNTLET runs **the same `sql_validator.py` file**, with SHA-256 `f014977c…` shown on screen and checked at build time.
   - It earns its LIVE badge only by matching the Python backend's verdict *and reason string* on 100% of the recorded corpus.
3. **It has a real antagonist and a real failure.**
   - TERRAIN had a protagonist (customer #276).
   - GAUNTLET has a dated incident: a real bypass, confirmed live through `/execute`, that leaked 18 real rows including the superuser flag. It was root-caused and fixed the same day.
   - The visitor can **re-run the vulnerable validator**, which is reconstructed and verified against 7 recorded verdicts, and then watch the fix close it.
   - No churn model has a story like this.
4. **One frame unifies every mandatory area.**
   - TERRAIN had one stage, but its six beats were mostly separate panels on that stage.
   - In GAUNTLET, the Explorer, Inspector, Builder, Security demos and Result Visualization all feed the *same 11 gates*. The whole site is one argument: *only what survives the gauntlet runs*.

## Decision: a live client-side validator, with a precomputed library as parity and fallback

- **Chosen: the real file in Pyodide, not a JS port.**
  - node-sql-parser and sql-parser-cst produce *different ASTs* from sqlglot. A port would re-decide, by hand, the exact distinctions the 2026-10-08 bug lived in (`table.db`, `exp.Anonymous`, `exp.Window`).
  - Divergence would be invisible and would undermine the whole truth claim.
  - Pyodide costs about 6–7 MB once. That is less than PREDICTIVE's ~14 MB ONNX payload.
- **Also built: a precomputed attack corpus** of about 40 cases. The verdicts are generated by the real Python validator, both current and reconstructed-before, at fixture time. The corpus serves three purposes:
  1. a browsable, filterable library;
  2. the parity suite that gates the LIVE badge;
  3. the complete experience when WASM is unavailable. In that case the console says plainly that free-text judging is off and offers the library.
- **Finite things are precomputed. Infinite things run the real code.** The builder's space is finite, so it is precomputed against the real `querymind_reader` role. Typed SQL is infinite, so it runs through the real validator live.

## Known gaps (handed to the next agents, not designed around silently)

1. **No time-series fixture exists**, so the line view has no honest data yet. The fixture generator must add a real monthly query. The `DATE_TRUNC('month', …)` form was verified ACCEPTED by the validator. Until then, the line toggle is disabled with the label `line view needs an ordered dimension`.
2. **`query_builder_grid.json` has 3 entries and no filters.** The generator's docstring promises more. The bounded enumeration is specified in `approved/interaction-map.md` and must be regenerated against Postgres.
3. **No phrase-to-clause alignment exists in any fixture.** The intro and Inspector derive links deterministically (identifiers and literals matched against question words). Anything not derivable is labeled *annotation*.
4. **The attack corpus and the reconstructed-before verdicts** must be generated in Python and written to a new `site/public/data/attack_corpus.json`.
