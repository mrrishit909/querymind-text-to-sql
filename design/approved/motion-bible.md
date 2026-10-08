# Motion bible (approved)

## Principle

**Motion only ever means "a query changed state."** A query can be typed, grouped, compiled, judged, passed, stopped, regenerated, executed or charted. If nothing changed state, nothing moves. There is no ambient drift, no parallax for depth, no particle field and no idle loop. The single exception is the LIVE dot's one pulse per verdict.

## Tokens

| Token | Value | Use |
|---|---|---|
| `ease.travel` | `linear` | slug moving between gates (a conveyor, constant speed) |
| `ease.settle` | `cubic-bezier(0.2, 0, 0, 1)` | things arriving: rows landing, panels docking |
| `ease.stop` | `cubic-bezier(0.3, 0, 0.2, 1)` over 90 ms | slug decelerating to a stop before the gate that held |
| `ease.inOut` | `cubic-bezier(0.65, 0, 0.35, 1)` | layout morphs: table to bar to line, deck transitions |
| `dur.gate` | 60 ms per gate | slug travel time per gate spacing (11 gates ≈ 660 ms) |
| `dur.flare` | 200 ms | a gate that held flares from silver 28% to 100%, then rests at 60% |
| `dur.width` | 420 ms | Martian Mono `wdth` transitions (112 → 87 → 75) |
| `dur.crossfade` | 160 ms | serif to mono family swap, at matched baselines |
| `dur.row` | 50 ms stagger, 240 ms each | result rows landing |
| `dur.morph` | 520 ms | table to bar to line |
| `dur.pulse` | 600 ms | the LIVE dot: one pulse per verdict, scale 1 → 1.8 → 1, opacity 1 → 0 |

## The canonical verdict animation

This plays every time a query is judged, from any source.

1. **Enter (0 ms).** The slug appears in the language zone at `wdth 87`.
2. **Travel.** The slug moves right at `dur.gate` per gate.
   - Each gate it crosses ticks: a 1px lime cap appears at the top of the gate and holds while this slug is selected.
3. **On PASS of G11:**
   1. The slug pauses for 120 ms.
   2. Text re-sets from input to regenerated, with a `wdth` 87 → 75 transition. A 160 ms crossfade runs on differing characters only. For the 12 questions there are none (the stored SQL is already regenerated), so only the width changes.
   3. The slug continues into the data zone and dissolves into the table header. Rows land with `dur.row`, `ease.settle`.
4. **On STOP at Gn:**
   1. The slug decelerates (`ease.stop`) and halts 8 px before Gn. Gn flares (`dur.flare`).
   2. The offending node, located through the AST (see `interaction-map.md`), lifts 16 px up out of the slug with a 1px silver connector to Gn.
   3. The reason string types in at 18 ms per character next to Gn.
   4. The slug body fades to slate fill and `wght` 300.
   5. Downstream gates stay untouched.
5. **On LLM decline:** the slug never forms.
   1. The grouped tokens drift to the dashed LLM gate and stop.
   2. Claude's real decline text (RECORDED `assumptions`) appears there in Instrument Sans.
   3. G1–G11 stay dark. This is the visual statement that the validator was never needed.
6. **Verdict source.** If LIVE, the ledger dot pulses at the moment of the verdict. If RECORDED, no pulse.

**Live typing (Console):**

- The verdict animation is **compressed**. The slug does not re-travel from the left on every keystroke. It **slides** from its previous stopping gate to its new one over `|Δgates| × 40 ms`, linear.
- The offending node and reason crossfade over 120 ms.
- This keeps typing feedback under about 200 ms perceived.

## Intro

The frame-by-frame timing is in `scroll-storyboard.md`. Rules:

- The intro is time-based, not scroll-based. **Skip** is first in the tab order and visible from frame 0. `Esc` also skips.
- Skip jumps to the exact end state of the 10.2 s frame. Nothing animates after a skip, except the rows landing (240 ms).
- The intro never waits for Pyodide. At 5.2 s, the gate pass is LIVE if the worker has already returned Q1's verdict, and RECORDED otherwise. The ledger states which.

## Scroll

- Scroll drives **which query is in the band** and **deck content**. It never scrubs an animation frame-by-frame. Beats trigger the canonical verdict animation when they enter (IntersectionObserver at 40% visibility).
- Upper and lower deck panels cross-dissolve between beats over 320 ms with `ease.inOut`, with a 24 px vertical offset.
- The band itself never moves vertically while it is sticky.

## Result morphs (Beat 2, Shape)

- **Table → bar.** Each numeric cell's text bounding box becomes the bar's start. The bar extrudes rightward to its value width (`dur.morph`). Dimension labels slide to a left axis.
- **Bar → line.** Bars collapse to their end caps, and the caps become points connected in dimension order. **Only enabled when the dimension is ordered.** The planned real monthly fixture is ordered; `city`, `category` and `status` are not. For unordered dimensions the line toggle is disabled with a reason.
- **Any → table.** The reverse, with numbers re-forming in their cells.
- A morph always preserves object identity: the row for "Outdoors" is the same DOM node in all three views, moved by FLIP.

## Breach choreography (Beat 5)

1. With `validator@before` (RECONSTRUCTED hatch on the ledger), the attack slug travels at **half speed** (120 ms per gate) through G1–G11.
   - At G9, the gate *opens*: a 24 px gap appears in its hairline where the bare-name check passed it.
   - The slug crosses. G11 ticks **breach-red** instead of lime.
2. The 18 EVIDENCE rows land in the data zone at 2× the normal stagger.
   - Row 16, `postgres · true`, lands last and holds a breach-red 1px outline.
3. **The visitor flips the switch to `current`.** This is visitor-triggered, never automatic.
   - G9's gap closes over 400 ms, so the hairline knits.
   - The slug re-runs from G1 at normal speed and stops at G9.
   - The `Table(db=pg_catalog)` node lifts with `unapproved table/view referenced: pg_roles`.
   - The 18 rows fade to 0 opacity and are replaced by an empty outlined table: `0 rows · rejected before the database saw it`.

## Reduced motion (`prefers-reduced-motion: reduce`)

- **Intro:** 4 static frames crossfade at 120 ms, holding 1.2 s each. Any key or click advances them.
- **Verdicts:** the slug appears **already at** its stopping gate. The gate shows its resting 60% state without the flare. The reason appears instantly.
- **Width changes** are instant. **Rows** appear all at once. **Morphs** crossfade at 160 ms.
- **Breach:** a static before/after pair, side by side. The switch swaps them with no travel.
- **The LIVE dot does not pulse.** It is solid.

## Performance budget

- Animate only `transform`, `opacity` and `font-variation-settings`. The last is the one paint-heavy property, and it is limited to a single slug at a time, never more than about 400 glyphs.
- No animation runs on more than 1 slug plus 50 rows simultaneously.
- WAAPI with FLIP. **No animation library is required.** Add one only if WAAPI measurably falls short.
