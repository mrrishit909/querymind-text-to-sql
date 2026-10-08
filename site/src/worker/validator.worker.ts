/// <reference lib="webworker" />
// The one engine. Loads the real, unmodified sql_validator.py (current and
// pre-fix historical) on self-hosted Pyodide + a pinned local sqlglot
// wheel, and judges every query the site shows a verdict for. No asset
// here is ever fetched from a CDN or PyPI -- everything comes from
// import.meta.env.BASE_URL + 'pyodide/' and + 'validator/', both served
// from this same origin. See design/approved/* for why.
import glueSrc from './qm_glue.py?raw'

const base = import.meta.env.BASE_URL

interface PendingJudge {
  id: number
  sql: string
  version: 'current' | 'prefix'
}

type OutMsg =
  | { kind: 'progress'; pct: number; stage: string }
  | { kind: 'ready'; sha: Record<string, { expected: string; actual: string; match: boolean }> }
  | { kind: 'error'; message: string }
  | { kind: 'result'; id: number; ok: boolean; reason: string; referencedViews: string[]; sql: string; ast: unknown; ms: number; version: string }

function post(msg: OutMsg) {
  ;(self as unknown as Worker).postMessage(msg)
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function fetchText(path: string): Promise<string> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`fetch failed (${res.status}): ${path}`)
  return res.text()
}

let pyodide: any = null
let judgeFn: ((sql: string, version: string) => string) | null = null
const queue: PendingJudge[] = []
let processing = false

async function init() {
  try {
    post({ kind: 'progress', pct: 5, stage: 'loading pyodide runtime' })
    const pyodideModuleUrl = `${base}pyodide/pyodide.mjs`
    // Dynamic import of the self-hosted ESM loader -- never the npm
    // package's bundled copy, so there is exactly one place (this public
    // folder) that determines what actually runs in the browser.
    const { loadPyodide } = await import(/* @vite-ignore */ pyodideModuleUrl)
    pyodide = await loadPyodide({ indexURL: `${base}pyodide/` })
    post({ kind: 'progress', pct: 35, stage: 'fetching validator source' })

    const [validatorSrc, prefixSrc, stubSrc, metaRaw] = await Promise.all([
      fetchText(`${base}validator/sql_validator.py`),
      fetchText(`${base}validator/sql_validator_prefix_historical.py`),
      fetchText(`${base}validator/connection_stub.py`),
      fetchText(`${base}validator/validator_meta.json`),
    ])
    const meta = JSON.parse(metaRaw) as Record<string, { sha256: string }>

    const [currentHash, prefixHash] = await Promise.all([sha256Hex(validatorSrc), sha256Hex(prefixSrc)])
    const sha = {
      'sql_validator.py': {
        expected: meta['sql_validator.py'].sha256,
        actual: currentHash,
        match: currentHash === meta['sql_validator.py'].sha256,
      },
      'sql_validator_prefix_historical.py': {
        expected: meta['sql_validator_prefix_historical.py'].sha256,
        actual: prefixHash,
        match: prefixHash === meta['sql_validator_prefix_historical.py'].sha256,
      },
    }
    if (!sha['sql_validator.py'].match || !sha['sql_validator_prefix_historical.py'].match) {
      post({ kind: 'error', message: 'validator source hash mismatch -- refusing to run an unverified file' })
      return
    }

    post({ kind: 'progress', pct: 45, stage: 'importing sqlglot' })
    await pyodide.loadPackage('micropip')
    const wheelUrl = new URL(`${base}pyodide/sqlglot-30.21.0-py3-none-any.whl`, self.location.origin).href
    pyodide.globals.set('QM_WHEEL_URL', wheelUrl)
    await pyodide.runPythonAsync(`
import micropip
await micropip.install(QM_WHEEL_URL, deps=False)  # deps=False: never resolves anything from PyPI
`)

    post({ kind: 'progress', pct: 70, stage: 'installing the real validator' })
    pyodide.FS.mkdirTree('/home/pyodide/db')
    pyodide.FS.writeFile('/home/pyodide/db/__init__.py', '')
    pyodide.FS.writeFile('/home/pyodide/db/connection.py', stubSrc)
    pyodide.FS.writeFile('/home/pyodide/sql_validator.py', validatorSrc)
    pyodide.FS.writeFile('/home/pyodide/sql_validator_prefix_historical.py', prefixSrc)
    pyodide.FS.writeFile('/home/pyodide/qm_glue.py', glueSrc)

    await pyodide.runPythonAsync(`
import sys
if '/home/pyodide' not in sys.path:
    sys.path.insert(0, '/home/pyodide')
import importlib
import sql_validator
import sql_validator_prefix_historical
import qm_glue
import json

def qm_judge_json(sql, version):
    try:
        return json.dumps(qm_glue.qm_judge(sql, version))
    except Exception as e:  # noqa: BLE001 - never crash the worker on bad input
        return json.dumps({"ok": False, "reason": f"internal error: {e}", "referenced_views": [], "sql": "", "ast": {"parsed": False, "error": str(e), "nodes": [], "statement_count": 0}})
`)
    judgeFn = pyodide.globals.get('qm_judge_json')
    post({ kind: 'progress', pct: 100, stage: 'ready' })
    post({ kind: 'ready', sha })
    processQueue()
  } catch (e) {
    post({ kind: 'error', message: e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e) })
  }
}

function processQueue() {
  if (processing || !judgeFn) return
  const job = queue.shift()
  if (!job) return
  processing = true
  const t0 = performance.now()
  let parsed: any
  try {
    const raw = judgeFn(job.sql, job.version)
    parsed = JSON.parse(raw)
  } catch (e) {
    parsed = { ok: false, reason: `internal error: ${e instanceof Error ? e.message : String(e)}`, referenced_views: [], sql: '', ast: { parsed: false, error: String(e), nodes: [], statement_count: 0 } }
  }
  const ms = performance.now() - t0
  post({
    kind: 'result',
    id: job.id,
    ok: !!parsed.ok,
    reason: parsed.reason ?? '',
    referencedViews: parsed.referenced_views ?? [],
    sql: parsed.sql ?? '',
    ast: parsed.ast,
    ms,
    version: job.version,
  })
  processing = false
  processQueue()
}

self.onmessage = (ev: MessageEvent) => {
  const data = ev.data
  if (data?.kind === 'judge') {
    // Newer judge requests supersede any still-queued (not-yet-started)
    // ones -- only the in-flight call (if any) is allowed to finish.
    queue.length = 0
    queue.push({ id: data.id, sql: data.sql, version: data.version })
    processQueue()
  }
}

init()
