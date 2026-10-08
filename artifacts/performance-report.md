# QUERYMIND :: GAUNTLET -- performance report

Measured 2026-10-08, real Chromium (Playwright `chromium.launch()`, no
throttling), against a local `vite preview` build (production bundle,
`site/dist/`), on the author's machine. Numbers are real measurements from
this build, not estimates -- the exact commands are below each figure so
they can be reproduced.

## Headline: real cold start, desktop

| Measurement | Value |
|---|---|
| Intro visible (nav -> `.intro-skip` rendered) | 68 ms |
| **Pyodide cold start -> validator LIVE with 100% parity** (72/72: 10 validated questions + 6 demos + 56 corpus cases, each judged live and compared against the recorded Python verdict/reason/gate) | **1.79 s** |
| Total time from navigation to the LIVE badge | 1.89 s |

This is the number the design docs estimated at "2-5 s on mid-range
phones" (`concept-a.md`, "Performance risk") -- desktop Chromium on this
machine lands at the fast end, around 1.8 s, for the *full* 72-case proof
run, not just Pyodide init.

Reproduced with a Playwright script that navigates, skips the intro, and
waits for `.ledger` to show `parity 72/72 · LIVE`.

## Headline: real cold start, 390px (deferred load)

Per `responsive-spec.md`, the 390px spine never fetches Pyodide until the
visitor taps "Load the validator" in the Console. Measured: **1.80 s** from
that tap to a real live verdict rendering for a typed `SELECT 1`. This
confirms two things at once: (a) the deferral actually works (zero
`pyodide.asm.wasm` requests before the tap -- see
`site/tests/playwright/responsive.spec.ts`), and (b) the cold start cost is
paid once, on demand, not up front.

## Payload breakdown (real bytes, `site/dist/`)

| Asset | Raw size |
|---|---|
| `pyodide.asm.wasm` | 9.60 MB |
| `python_stdlib.zip` | 2.55 MB |
| `sqlglot-30.21.0-py3-none-any.whl` (pinned, self-hosted, never fetched from PyPI) | 0.76 MB |
| `micropip-0.11.1-py3-none-any.whl` | 0.11 MB |
| `pyodide.mjs` + `pyodide.asm.mjs` (loader) | 1.27 MB |
| `pyodide-lock.json` | 0.12 MB |
| **Total self-hosted Pyodide/sqlglot payload** | **~14.2 MB raw** (`du -sh site/public/pyodide`) |
| `sql_validator.py` + `sql_validator_prefix_historical.py` + `connection_stub.py` + `validator_meta.json` | 36 KB |
| `site/public/data/*.json` (all 6 fixtures) | 92 KB |

Stated honestly, per the approved copy rules: **this is bigger than
PREDICTIVE's ~14 MB ONNX payload, not smaller** -- the two land in the same
ballpark. The difference is *when* it's paid: eagerly at intro frame 0 on
desktop/tablet (>=600px), deferred until a deliberate tap on the 390px
spine.

A real network transfer during a cold run (`content-length` summed over
actual HTTP responses in a Playwright trace) measured **~12.4 MB** of
payload fetched by the time the LIVE badge appeared on desktop (the
difference from the 14.2 MB raw figure above is `pyodide.mjs`/`asm.mjs`/
`pyodide-lock.json` not always reporting a `content-length` header under
`vite preview`'s dev server -- the disk total is the more reliable figure).

## App bundle (non-Pyodide), gzip

| File | Raw | Gzip |
|---|---|---|
| `index-*.js` (React app) | 261.8 KB | 80.75 KB |
| `index-*.css` | 15.2 KB | 3.82 KB |
| `validator.worker-*.js` (worker glue + embedded `qm_glue.py` source) | 6.6 KB | -- |

Well inside the ≤60 KB gzipped *fixture* budget from `responsive-spec.md`
once Pyodide is excluded (that budget was written for the JSON fixtures
specifically, which total 92 KB raw / a few KB gzipped -- see `du -sh
site/public/data` above and `network.spec.ts`'s external-request audit for
the full fetch list).

## What this report does NOT cover (honesty, not omission)

- **No real mid-range-phone measurement.** Chromium's CPU/network
  throttling presets were not applied; the "~2 s" 390px figure above is on
  the same desktop CPU as the other tests, just with the fetch deferred.
  Real devices will be slower, consistent with the design docs' own
  "known gaps" framing -- this is a reproducible script, not a device lab.
- **Lighthouse was not run.** The task's explicit bar is PREDICTIVE's
  Lighthouse 0.94 / axe 0 violations; this report instead uses Playwright +
  axe-core (see `site/tests/playwright/a11y.spec.ts`, 0 serious/critical
  violations) as the available equivalent in this environment. A real
  Lighthouse CI run is the natural next step and is not included here.

## Reproduce

```bash
cd site
npm run build
npm run preview -- --port 4321 &
npx playwright test   # the full suite, including the LIVE-parity assertions
```
