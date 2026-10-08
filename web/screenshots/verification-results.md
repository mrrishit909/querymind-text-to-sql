# Chat UI verification results (chat-ui-engineer, 2026-10-08)

All checks run with Playwright (borrowed from `~/portfolio/node_modules/playwright`,
not added as a new project dependency).

## 1. Markdown sanitization (task 4)

Mocked `answer` field: `Here is the answer: <script>alert(1)</script> and a
[link](javascript:alert(2)) plus a markdown image ![x](http://evil.example/x.png "pwn")
and **bold** text.`

Rendered DOM (`.prose-invert` innerHTML):
```html
<p>Here is the answer: alert(1) and a <a>link</a> plus a markdown image
<img alt="x" title="pwn" src="http://evil.example/x.png"> and <strong>bold</strong> text.</p>
```
- `scriptElementsInAnswer`: 0 (no `<script>` element exists in the DOM)
- `rawScriptTagLiteralInDOM`: false
- anchor `href` after sanitization: `[null]` (the `javascript:` URL was stripped by
  rehype-sanitize's default schema; the link text remains as inert text)
- Markdown image and bold rendered normally, no broken layout.

See `desktop-1280.png` for the rendered evidence panel with this answer showing as a
message (same mock payload was reused for the screenshot).

## 2. Screenshots (task 7)

- `desktop-1280.png`, 1280px viewport, evidence panel open (Monaco SQL, bar chart, table)
- `mobile-390.png`, 390px viewport, same state
- `reduced-motion.png`, `page.emulateMedia({ reducedMotion: 'reduce' })`, fresh load:
  `canvasCount: 0`, `skipButtonCount: 0`, confirms `Intro.tsx` calls `onDone()`
  immediately and renders nothing when `prefers-reduced-motion: reduce` is set.

## 3. Keyboard accessibility (task 6)

Tab order from page load (no turns yet): `input#question` -> `button[Ask]` -> 4x example
chip `button`s, in that order. Matches natural DOM order, no tabindex hacks needed.

After a turn exists, `details > summary` ("Evidence panel") is confirmed focusable via
`.focus()` and `document.activeElement` equality check (`evidenceToggleFocusable: true`).

Contrast ratio, body text `#DCE1E6` on background `#0D1015` (WCAG relative-luminance
formula): **14.48:1**, exceeds WCAG AA (4.5:1) and AAA (7:1) for normal text.

## 4. SSE staged progress (task 5)

Playwright's `route.fulfill` delivers mocked bodies atomically (can't test real chunking),
so this was verified against a disposable Node stub server
(`scripts` not committed, ephemeral) that streams real `event:`/`data:` frames with 350ms
gaps, proxied through `vite dev`'s existing `/api` -> `:8010` rewrite. Observed status-line
text over time, in order:

1. "Asking Claude…" (generating_sql)
2. "Validating SQL…" (validating)
3. "Running query…" (executing)

Then the final answer rendered exactly as the non-streaming path does. Confirms
`web/src/api.ts::streamAsk()` correctly parses chunked SSE frames and drives the UI live.

**Not yet verified**: end-to-end against the real FastAPI `/ask/stream` endpoint, since
that endpoint (owned by sql-security-engineer) was not present in `api.py` at the time of
this session. If its event names or payload differ from the documented contract
(`generating_sql` / `validating` / `executing` / `answer`), `streamAsk()` will silently fall
back to `POST /ask` rather than crash (any stage name it doesn't recognize is ignored; only a
recognized `answer` event resolves the promise, and anything else, including a `404`,
throws and triggers the fallback in `App.tsx`), but the live status line simply won't show
until the names line up.

## 5. Build (task 8)

```
dist/index.html                   0.45 kB │ gzip:   0.28 kB
dist/assets/index-*.css          10.92 kB │ gzip:   3.23 kB
dist/assets/index-*.js          787.87 kB │ gzip: 235.03 kB
```

Monaco is not bundled into the main JS chunk: `@monaco-editor/react`'s default loader
fetches `monaco-editor` from a CDN at runtime the first time the evidence panel mounts an
editor, instead of shipping it in the app bundle. Trade-off documented, not changed.
