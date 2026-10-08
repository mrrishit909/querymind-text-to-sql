# Concept C: CASE FILE

## Visual thesis

QUERYMIND is presented as a dated incident file.

This is the lowest-abstraction concept, with the highest text density. The whole site is typeset as a forensic engineering report: **"Case QM-2026-10-08: a validator that said yes."** The structure follows how real security write-ups are read:

1. **Summary.**
2. **System under test.** The pipeline, with the 12 questions as "Exhibit A: normal operation".
3. **Method.** The validator, with "Exhibit B: six demonstrations".
4. **Finding.** The bypass, with "Exhibit C: 18 rows that should not exist".
5. **Remediation.** The real diff of 3 hunks.
6. **Re-verification.** Exhibit D: the same query, rejected.
7. **Residual risk.** The `SET statement_timeout` nuance, the window function / `||` doc mismatch, and the `public.customers` control case.

Every exhibit is a live, interactive figure embedded in the document column:

- The SQL Inspector is "Exhibit A-1 to A-12".
- The builder is "Exhibit E: reproduce it yourself".
- The console is "Exhibit F: attempt your own".

Each figure is stamped with a provenance class: `LIVE`, `RECORDED`, `RECONSTRUCTED` or `EVIDENCE`.

## Palette

- **Obsidian** is the "page". This is a dark report, not a paper pastiche.
- **Silver** is the body text, set at 17/28.
- **Slate** carries exhibit frames and the margin rule.
- **Cobalt** is used for cross-references and SQL keywords.
- **Lime** is used for highlighted evidence passages and accepted verdicts.
- **Breach `#FF5C4D`** is used for the finding's stamp and the leaked rows only.
- **Redaction bars** are solid silver blocks over values that the report "withholds". For example, `client_addr` in the `pg_stat_activity` evidence is redacted on principle, even though it is a private Docker address.

## Typography

- **Newsreader** (OFL, `opsz` 6–72) sets the report's body and headings. It is a newspaper-grade serif with an optical-size axis, used from 13 px footnotes to 88 px headlines.
- **Martian Mono** sets the exhibits, SQL, timestamps and file paths (for example `artifacts/verification/schema_qualified_cte_bypass_live_api.txt`).
- **Instrument Sans** sets the stamps and the margin metadata (exhibit numbers, provenance class) in small caps at `wdth 75`.

## Layout strategy

- **A single 68 ch document column, with a 240 px margin rail on the right (1440 px).** The rail holds exhibit numbers, file-path citations, and a running "case clock" of the day's events. The events are ordered, with no invented times:
  1. found
  2. confirmed live
  3. root-caused
  4. fixed
  5. container rebuilt
  6. re-verified
- **Exhibits break out to 1100 px.** The column is otherwise strictly editorial.
- **Density is high.** Footnotes cite real test names, such as `tests/test_verification_adversarial.py`, and the audit's final count of **87 passed, 2 skipped**.

## Opening storyboard (~9 s)

1. **0–1.2 s.** A case header types out in mono: `QM-2026-10-08 · system under test: QUERYMIND`.
2. **1.2–2.6 s.** The Q1 question sets as a pull-quote in Newsreader. Phrases receive margin-note underlines.
3. **2.6–4 s.** The underlined phrases detach into the margin as 5 annotated groups.
4. **4–5.5 s.** Each margin note rewrites itself as its SQL clause, and the clauses slide back into the column as an indented code exhibit.
5. **5.5–7 s.** Exhibit A-1's result table typesets row by row beneath it.
6. **7–8 s.** The table's numeric column becomes inline bar rules, the classic report "sparkbar".
7. **8–9 s.** The page scrolls itself to the Summary, and the exhibit becomes the first figure of the report.

**Reduced motion:** the document is static from frame 0.

## Motion grammar

- **Typewriter for provenance.** Only case headers and verdict stamps type in.
- **Stamps** land with a 1-frame offset, then settle over 120 ms.
- **Exhibits animate only when interacted with.** Everything else is static text.

## Primary interaction

- **Exhibit F** is a console in the document. A verdict stamp appears, along with the reason, and a footnote cites the gate in the real source file.
- The version toggle is phrased as "view this exhibit as of: before fix / after fix".

## Technical approach

- DOM-only: React with semantic `<article>`, `<figure>`, `<figcaption>`.
- Pyodide worker, as in A, with figures as islands.
- Excellent accessibility and print stylesheet. It is the cheapest concept to build.

## Performance risk

- **Low rendering risk, but high *engagement* risk.** It reads beautifully and *looks like a document*.
- The mandated transformation of language into structured data happens inside small figures, so the visual identity risks reading as "a blog post with code blocks".
- Technically, the risk is many exhibit islands each holding Pyodide results. A shared worker and a single result cache are required to avoid re-judging the same SQL dozens of times on scroll.
