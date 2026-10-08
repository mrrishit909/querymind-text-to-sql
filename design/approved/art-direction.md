# Art direction: QUERYMIND · GAUNTLET (approved)

This is Concept A, GAUNTLET. It carries two grafts from the losing concepts:

- **From C:** dated exhibit framing for the Breach, provenance stamps, and file-path citations.
- **From B:** the real sqlglot AST, drawn at single-query scale.

See `../concepts/selection.md`.

## One sentence

**Every query, whether Claude's, the builder's, a demo's or yours, walks through the same 11 real checks of the production validator running in your browser. Only what survives is allowed to become data.**

## The identity

1. **The gauntlet.** Eleven vertical hairline gates make up the site's logo, frame and main visualization at once.
   - Each gate is a real check in `sql_validator.py::validate_sql`, in source order (G1 PARSE … G11 REGENERATE).
   - The full table, with the reason-prefix mapping, is in `../concepts/concept-a.md`.
   - Upstream of G1, a dashed **LLM gate** marks where Claude can decline. It is a separate layer, never conflated with the validator.
   - Downstream of G11, four dim **DEPTH gates** show layers that are never run live: read-only transaction, role grants (5 views only), RLS on base tables, and 3 s `statement_timeout`. They are RECORDED evidence.
2. **The slug.** A query is a typeset block of SQL clauses. It is physical.
   - It travels left to right, from language to data.
   - It stops at the gate that rejects it. The offending AST node lifts off and hangs on that gate with the real reason string.
   - If it passes G11, it is re-typeset from the AST (`wdth` 87 → 75), and that string becomes rows. The site shows that what runs is the AST's output, not the input text.
   - **Honesty note.** For the 12 questions, the fixture stores the backend's already-regenerated SQL. Claude's raw text was not kept (`generate_site_fixtures.py` writes `result.sql`). So for those questions the live re-run proves **idempotence**: "regenerating it again yields the identical string."
   - A visible raw-to-regenerated text difference is shown only where it is real:
     - in the Console, for visitor SQL (e.g. `from v_customers c` → `FROM v_customers AS c`);
     - for the questions, only if the generator starts storing `proposed_sql`.
3. **The engine.** The real `sql_validator.py` (SHA-256 `f014977c61444811b046b652bea7ee9e6764ab70635d0212d3d06f793fffc50d`) runs unmodified on Pyodide with pinned sqlglot 30.21.0 in a Web Worker.
   - The only substitution is `db/connection.py`, replaced by a stub that exports `APPROVED_VIEWS`. The build asserts that the set is equal to the real one.
   - A persistent **engine ledger** at the bottom left always shows the real state:
     - `validator · loading 38%`
     - `validator · parity {n}/{n} · LIVE · sha f014977c`
     - or `validator · unavailable · recorded verdicts only`
4. **The protagonist: Q1.** "Which 3 product categories generate the most revenue from completed orders?" It opens the site. It has real SQL with 3 joins, a real filter and a real 3-row answer.
5. **The antagonist: the 2026-10-08 bypass.** `WITH pg_roles AS (SELECT 1 AS x FROM v_customers) SELECT rolname, rolsuper FROM pg_catalog.pg_roles`. It is the one query in the site's history that walked through all 11 gates when it should not have.

## Voice

- Claims are set in Instrument Sans: short, plain, declarative. Examples:
  - "Only what survives the gauntlet runs."
  - "On 2026-10-08, one gate had a hole."
- Evidence is set in Martian Mono, and is always next to the mark it describes.
- The human question is always set in Newsreader serif. That is the only place serif appears, apart from the Breach's exhibit captions.
- **Never use** "AI-powered", "magic", "chat", "assistant", "ask me anything", or a robot or brain icon.
- **Never say** "unhackable", "secure by design" or "bulletproof". The site's credibility comes from showing a real failure.

## Provenance is visible

Every value on screen belongs to exactly one class. The treatment is set in `typography.md` and `colors.md`.

| Class | Source | Treatment |
|---|---|---|
| **LIVE** | computed now by the real `sql_validator.py` in Pyodide | mono, with a 4 px lime dot that pulses once per verdict |
| **RECORDED** | fixture JSON produced by the real backend: Claude output, executed rows, measured cost, Python verdicts | mono, no dot |
| **EVIDENCE** | verbatim from `artifacts/verification/*.txt` | mono inside a slate exhibit frame, with the file path cited underneath |
| **RECONSTRUCTED** | `validator@before`: the current file minus the 3 hunks documented in `REQUIREMENTS_AUDIT.md`. It reproduces all 7 recorded pre-fix verdicts (5 in `schema_qualified_cte_bypass.txt`, plus window and `\|\|` per the audit). | 45° hatch (slate on obsidian) behind the value, and the label `reconstructed` |
| **ANNOTATION** | editorial: a phrase→clause link that cannot be derived by matching | dotted underline, silver-dim, labeled in the legend |
| **NOT EXECUTED** | accepted by the live validator, but the static site cannot run it | an empty, outlined result table with `not executed · static site` |

**Mandatory honesty copy** (wording can be tuned, meaning cannot):

- **Console accept:** "Accepted by the validator. On the real server this would now run as `querymind_reader`, inside a read-only transaction with a 3-second timeout. It is not run here; this is a static site."
- **Rows for a typed query** are shown **only** if its regenerated SQL is string-equal to a recorded execution. Otherwise the result is NOT EXECUTED. Variants of the breach query never show leaked rows unless they equal one of the 3 recorded `/execute` attacks.
- **Breach:** "Found by an adversarial verification pass on 2026-10-08, confirmed live through `POST /execute`, fixed and re-verified against a rebuilt container the same day." Do not invent times of day.
- **Before-validator:** "Reconstructed: today's file with the 3 fix hunks reverted. Reproduces all 7 recorded pre-fix verdicts. The original pre-fix file was not preserved."
- **Truncation:** Q8's table reads `showing 50 of 189 rows · fixture cap`.
- **Cost:** "12 real Claude calls · total $0.049 (fixture `total_cost_usd`)". The model name is read from `questions.json.model`. Never hard-code it.
- **Test count**, if quoted: "87 passed, 2 skipped" (the audit's final figure).

## What this site must never look like

- **A chat window**: message bubbles, an avatar, a "typing…" indicator, or a send arrow in a rounded pill. This is the hard rejection condition.
- **A security-vendor dashboard**: shield icons, padlocks, threat-level gauges, or red-alert banners.
- **A code playground**: Monaco plus a split pane plus a "Run" button.
- **Matrix rain, glitch effects or hacker green.** Lime is data, not "terminal aesthetic".
- **A validator verdict computed by anything other than `sql_validator.py`.**
