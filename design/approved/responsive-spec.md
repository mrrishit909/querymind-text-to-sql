# Responsive spec (approved)

There are three genuinely different compositions. The gauntlet stays the organizing frame at every width, but its **orientation and role change**.

## 1440 px (desktop, reference): the corridor

- **The band** is horizontal, sticky, and about 32% of viewport height (min 260 px).
  - The language zone takes columns 1–3, the gates columns 4–9, and the data zone columns 10–12.
  - There are 11 gates, plus the dashed LLM gate and the 4 depth gates.
  - Gate labels show `G9` at rest and the full name on hover or focus.
- **Decks.** The upper deck holds the Explorer (6 category columns × 2) or the chips or the demo strip. The lower deck holds the 4-column Inspector, the Console with the AST, the corpus matrix, or the exhibit.
- **The corpus matrix** columns align to the gate x positions.
- **Intro.** The question is set at 56 px. The 3 result bars dock into the Inspector.
- **Pyodide** starts loading at intro frame 0.

## 768 px (tablet): the stacked corridor

- **The band stays horizontal** but compresses.
  - The language zone shrinks to a single line of the slug's first clause, followed by `…`.
  - The 11 gates span the full 8 columns at about 52 px spacing, labels `G1`–`G11` only.
  - The data zone **moves below the band** as a full-width strip of 3–8 rows. This keeps the left-to-right gate travel legible.
  - The depth gates are hidden in the band and appear only in Beat 6, as a list.
- **Explorer:** 2 columns × 3 categories. Questions are set in Newsreader 18/26.
- **Inspector:** 2 columns. Question, assumptions and cost on the left. SQL, views and result on the right. The AST sits below, full width, capped at 30 nodes.
- **Console:** full width under the band. The AST is under the input. The corpus matrix is horizontally scrollable *inside its own container*, with the gate columns kept and the first column (case label) frozen. The page never scrolls sideways.
- **Breach:** the diff hunks stack under the band and lose gate alignment. Each hunk is labeled with its gate instead.
- **Intro:** the question is set at 40 px. The groups wrap onto 2 lines. Timing is the same.
- **Pyodide:** starts at intro frame 0 (tablets are usually on Wi-Fi).

## 390 px (phone): the spine

**The corridor rotates 90°.** Language is at the top, data at the bottom, and the gates become horizontal notches.

- **The spine** is a 56 px column on the left edge, sticky.
  - It is a vertical hairline with 11 notches, labeled `1`–`11`, at 11 px mono.
  - The LLM notch is dashed, at the top.
- **The slug is a full-width card to the right of the spine.** Its *top edge* indicates progress. As a verdict plays, a lime fill runs down the spine notch by notch, so the card "descends" through the gates.
- **On a rejection:**
  - The fill stops at notch n, and that notch flares.
  - The reason appears in the card under a `G{n} · {gate name}` heading.
  - The offending AST node is shown inline as a single highlighted line, not as a tree (for example `Table · pg_catalog.pg_roles`).
- **Data** appears *below* the slug card, in the normal document flow:
  - a table of up to 5 rows, then "show all";
  - bar charts are horizontal and full width;
  - the line chart is full width at a 4:3 ratio.
- **Explorer:** a single column, with category headers as sticky subheads. Each question is a 2-line row.
- **Inspector:** a single column in this order:
  1. question;
  2. SQL (horizontally scrollable *within its block*, `wdth` 75 to fit more);
  3. views as chips;
  4. result;
  5. assumptions;
  6. AST behind a "Show syntax tree" disclosure. Before the console is opened (no Pyodide), the tree, gate, lit views and offending node render from the RECORDED fields that `scripts/verdict_glue.py` wrote into the fixtures. See `interaction-map.md` §1.
- **Console:**
  - The **Pyodide load is deferred until the visitor opens the console** ("Load the validator · ~6 MB"). The button states the real transferred size measured at build.
  - Until then, Beat 4 shows the 6 demos and the corpus as RECORDED. The corpus is a list, not a matrix, with each row showing `G{n}` and the verdict.
  - The open console is a **bottom sheet at 92% height**. This is the only overlay on the site. The spine stays visible on its left edge, so the gates are never hidden while judging.
  - The input is 4 lines tall.
- **Breach:**
  - The version switch is sticky at the top of the exhibit.
  - The 18 rows are shown as a compact 2-column list.
  - The diff is shown as 3 stacked hunks with gate labels.
  - The "Apply the fix" switch spans the full width.
- **Intro:**
  - The question is set at 28 px Newsreader, over 3–4 lines.
  - The groups stack vertically and each becomes one clause line.
  - The slug descends the spine notches, the gates appear as notches, and the rows drop in below.
  - The bars render horizontally, full width, and dock in place.
  - Total 9.4 s: the gate pass is shortened to 0.8 s.
- **Typography at 390:**
  - display claim 40/42;
  - section claim 28/32;
  - question 22/30;
  - SQL 13/20;
  - table 12/18.
- **Touch:**
  - All targets are at least 44 × 44 px.
  - The spine notches are not interactive. Tapping one reveals the gate name as a tooltip only.

## Common rules

- **No horizontal page scroll at any width.** Wide content (SQL, the corpus, the 196-row `information_schema` evidence) scrolls inside its own bounded container, with a visible fade edge.
- **Side gutters:** 16 px at 390, 32 px at 768, 48 px at 1440.
- Breakpoints: `<600` uses the spine, `600–1099` the stacked corridor, `≥1100` the corridor.
- **Reduced motion and skip** behave identically at every width.
- **Performance targets** on a mid-range phone (Moto G-class, 4G):
  - first meaningful paint (question visible) under 1.5 s;
  - fixtures not blocking the intro. Today's 4 fixtures are 4.8 KB gzipped in total. The budget, including the new grid and corpus, is ≤ 60 KB gzipped. The 196-row evidence is excluded and loads in Beat 5;
  - no Pyodide bytes fetched before the console is opened.
