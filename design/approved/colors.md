# Colors (approved)

There are 5 mandatory colors, unchanged. There are 4 derived tokens, and 1 single-use extension. All contrast ratios below were computed with the WCAG 2.x formula on 2026-10-08.

## Tokens

| Token | Hex | On obsidian | Use |
|---|---|---|---|
| `--obsidian` | `#0D1015` |, | page and field background (`body` sets it explicitly) |
| `--silver` | `#DCE1E6` | 14.48:1 | human language, body text, headlines, gate hairlines (at 28% alpha) |
| `--cobalt` | `#416CFF` | 4.37:1 | **structure**: SQL clause slugs (fill at 14%, 1px stroke at 100%), AST edges, gate labels at ≥ 18.66 px bold or ≥ 24 px. **Never for small text.** |
| `--lime` | `#C1F46D` | 14.91:1 | **data and passage**: rows, chart marks, a gate tick when passed, the LIVE dot, the "accepted" verdict |
| `--slate` | `#25313B` | 1.43:1 (surface only) | panels, a rejected slug's fill, inactive gates, the hatch for RECONSTRUCTED |
| `--cobalt-ink` (derived) | `#7F9BFF` | 7.29:1 | cobalt at text size: SQL keywords, AST node labels, links |
| `--silver-dim` (derived) | `#8B96A1` | 6.33:1 · 4.41:1 on slate | metadata, captions, annotation underlines |
| `--raised` (derived) | `#141920` |, | the Inspector and Console surface, one step above obsidian |
| `--line` (derived) | `#2E3B47` |, | hairlines and table rules (non-text, decorative) |
| `--breach` (extension) | `#FF5C4D` | 6.25:1 | **one event only**: the historical G9 failure, its leaked rows, and the "before" validator's verdicts when they accept something the current one rejects |

## Semantic rules

1. **Hue is a binding, not a decoration.**
   - A word in the question, its clause in the SQL and its node in the AST share **cobalt-ink**.
   - A value in the result table, its bar and its line point share **lime**.
2. **Rejection is not red.**
   - A rejected slug turns **slate**, and its text goes to silver-dim.
   - The gate that held flares **silver at 100%** for 200 ms, and then rests at 60%.
   - The offending node is outlined in silver, with its reason in silver mono.
   - A rejection means the system *worked*.
3. **Breach-red is rationed.** It appears only:
   - in the Breach beat;
   - on before/after divergences of the *leak class* only.

   A divergence is a case where `validator@before` accepts and `validator@current` rejects. It is split three ways, deterministically, following the audit's own classification:

   | Divergence | Treatment | Label |
   |---|---|---|
   | Stops at G9 now, on a `Table` qualified `pg_catalog` or `information_schema` | **breach-red** | `same class as the recorded leak` |
   | Stops at G9 now, any other qualifier (e.g. `public.customers`) | silver | `would have reached the database · role grants decide` (cite the recorded `permission denied for table customers`) |
   | Stops at G7 now (window, `\|\|`) | silver-dim | `outside the documented surface · no data escape (audit)` |

   - Nowhere else, ever. There are no red hover states and no red errors. Network or load failures use silver-dim text.
4. **Lime means "real data or a real pass" and nothing else.** No lime buttons, and no lime decoration. Primary buttons are silver text on slate, with a cobalt 1px focus ring.
5. **Accepted-but-not-executed** uses a lime *outline* with an empty interior. Lime fill is reserved for rows that really exist.

## Chart palette

- **Single series.** Bars and line in lime. Axis and gridlines in `--line`. Labels in silver-dim.
- **Comparisons** (builder before/after selection): the current selection is lime, and the previous one is a silver at 35% ghost. There are never two saturated hues.
- **Corpus matrix** (cases × gates):
  - passed cell: lime at 70%;
  - stopping cell: silver at 100%;
  - unreached cell: slate;
  - before/after divergence: a breach-red 2px outline on the row.

## Focus and state

| State | Treatment |
|---|---|
| Focus ring | 2px `--cobalt` with a 2px obsidian offset. It must be visible on every interactive element. |
| Selected question | silver text, with a 2px lime bar on the leading edge (lime is used because it is selecting real data) |
| Hover | `--raised` background. No color shift of the text. |
| Disabled (e.g. the line toggle without ordered data) | silver-dim at 60%, with a visible reason text, not just a tooltip |

## Dark only

The site is dark by mandate (obsidian). There is no light theme. A `prefers-contrast: more` media query raises `--silver-dim` to `--silver`, and gate hairlines to 60%.
