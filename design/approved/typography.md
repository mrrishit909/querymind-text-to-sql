# Typography (approved)

There are three families, all SIL OFL, all from Google Fonts or self-hosted from the same files. Each one is a *voice*, and the voice tells you what kind of thing you are reading.

| Voice | Family | Axes used | Role |
|---|---|---|---|
| **Human** | **Newsreader** | `opsz` 6–72, `wght` 300–600, italic | Natural-language questions only, plus the Breach exhibit captions |
| **Machine** | **Martian Mono** | `wdth` 75–112.5 (read the real range from the served file; sources disagree on the top end), `wght` 300–700 | SQL, AST labels, reasons, every number, file paths, the engine ledger |
| **Claim / UI** | **Instrument Sans** | `wdth` 75–100, `wght` 400–700 | Headlines, claims, buttons, labels, navigation |

## Width is meaning (Martian Mono)

The width of machine text encodes how structured it is. This is the site's typographic signature, and it is animated with WAAPI on `font-variation-settings`.

| State | `wdth` | `wght` | Example |
|---|---|---|---|
| Token: a phrase lifted from the question | 112 (or max available) | 400 | `product categories` |
| Clause: input SQL, i.e. the stored question SQL (RECORDED) or visitor text | 87 | 450 | `WHERE o.status = 'completed'` |
| Regenerated: the string `stmt.sql()` emitted after G11 | 75 | 500 | `SELECT p.category, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue …` |
| Rejected slug | 87 | 300 | the same slug, thinner: the query lost weight |
| Reason string | 87 | 500 | `unapproved table/view referenced: pg_roles` |

## Scale (1440 px; see `responsive-spec.md` for others)

| Role | Family | Size / line height | Settings |
|---|---|---|---|
| Display claim | Instrument Sans | 88/88 | `wght` 600, `wdth` 80, tracking -2% |
| Section claim | Instrument Sans | 48/52 | `wght` 600, `wdth` 85 |
| Question, hero | Newsreader | 56/64 | `opsz` 72, `wght` 400 |
| Question, in Explorer | Newsreader | 20/28 | `opsz` 20, `wght` 400 |
| Body / caption | Instrument Sans | 16/24 | `wght` 400, max 52ch |
| SQL in slug | Martian Mono | 15/22 | see the width table |
| SQL in Inspector | Martian Mono | 14/22 | `wdth` 87 |
| Gate label | Martian Mono | 11/14 caps | `wdth` 75, `wght` 600, tracking +6%, cobalt-ink |
| Table cells | Martian Mono | 13/20 | `wdth` 87, tabular by default; numbers right-aligned |
| Ledger / provenance tag | Martian Mono | 11/16 | `wdth` 75, silver-dim |

## Provenance typography

| Class | Typographic marker |
|---|---|
| LIVE | a 4 px lime dot before the value |
| RECORDED | no marker (the default) |
| EVIDENCE | slate frame, with a `file:` citation line below in 11 px silver-dim |
| RECONSTRUCTED | a 45° slate hatch behind the value, and the suffix ` · reconstructed` |
| ANNOTATION | a 1px dotted silver-dim underline (derived links use a solid cobalt-ink underline) |
| NOT EXECUTED | an outlined, empty table with the caption `not executed · static site` |

## Rules

- **Serif is never used for machine output.** Mono is never used for the human question. The intro's transformation is visible *because* the families switch.
- **No glyph morphing.** The serif-to-mono switch is a 160 ms crossfade at matched baselines. After that, only `wdth` and `wght` animate.
- SQL is never syntax-highlighted in rainbow colors. Keywords are cobalt-ink, identifiers silver, and literals lime: a literal is data.
- `font-display: swap`. Preload Martian Mono and Newsreader, which are visible in the first second.
- Subset to Latin.
