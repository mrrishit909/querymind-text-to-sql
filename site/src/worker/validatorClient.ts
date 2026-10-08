import { classifyGate } from '../lib/gates'
import { locateOffendingNode } from '../lib/locate'
import type { JudgeResult, ValidatorVersion } from '../lib/types'

export type EngineStatus =
  | { kind: 'loading'; pct: number; stage: string }
  | { kind: 'live'; parity: { ok: number; total: number }; sha: string }
  | { kind: 'unavailable'; reason: string }

type Listener = (s: EngineStatus) => void

const WATCHDOG_MS = 1500
const MAX_RESTARTS = 2

class ValidatorClient {
  private worker: Worker | null = null
  private nextId = 1
  private pending = new Map<number, { resolve: (r: JudgeResult) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout>; sql: string; version: ValidatorVersion; startedAt: number }>()
  private listeners = new Set<Listener>()
  private restarts = 0
  private status: EngineStatus = { kind: 'loading', pct: 0, stage: 'starting' }
  private shaCurrent = ''
  private _readyPromise: Promise<void> | null = null
  private resolveReady!: () => void

  /** Lazily spawns the worker on first access. On the 390px spine this
   * means the ~16MB Pyodide payload never fetches until the visitor opens
   * the console (Console.tsx gates its own call behind a tap), matching
   * responsive-spec.md's "no Pyodide bytes fetched before the console is
   * opened". Desktop/tablet still touch this at intro frame 0 via App.tsx,
   * so nothing changes for them. */
  /** True once something has actually triggered the worker spawn (desktop
   * frame-0 start, or a mobile visitor opening the console). Lets callers
   * that gate on viewport width re-check without re-gating forever. */
  get started(): boolean {
    return this._readyPromise !== null
  }

  get ready(): Promise<void> {
    if (!this._readyPromise) {
      this._readyPromise = new Promise((res) => {
        this.resolveReady = res
      })
      this.spawn()
    }
    return this._readyPromise
  }

  private spawn() {
    const worker = new Worker(new URL('./validator.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (ev: MessageEvent) => this.handleMessage(ev.data)
    worker.onerror = (ev) => this.handleFatal(ev.message || 'worker crashed')
    this.worker = worker
  }

  onStatus(fn: Listener): () => void {
    this.listeners.add(fn)
    fn(this.status)
    return () => this.listeners.delete(fn)
  }

  private setStatus(s: EngineStatus) {
    this.status = s
    for (const l of this.listeners) l(s)
  }

  getStatus() {
    return this.status
  }

  private handleMessage(data: any) {
    if (data.kind === 'progress') {
      this.setStatus({ kind: 'loading', pct: data.pct, stage: data.stage })
    } else if (data.kind === 'ready') {
      this.shaCurrent = data.sha?.['sql_validator.py']?.actual ?? ''
      this.resolveReady()
      // parity is filled in once runParityCheck() completes; until then
      // report live-but-unverified so callers can show a provisional state.
      this.setStatus({ kind: 'live', parity: { ok: 0, total: 0 }, sha: this.shaCurrent })
    } else if (data.kind === 'error') {
      this.handleFatal(data.message)
    } else if (data.kind === 'result') {
      const job = this.pending.get(data.id)
      if (!job) return
      clearTimeout(job.timer)
      this.pending.delete(data.id)
      const gate = data.ok ? null : classifyGate(data.reason)
      const offendingNodeId = data.ok ? null : locateOffendingNode(data.ast, data.reason, gate)
      job.resolve({
        ok: data.ok,
        reason: data.reason,
        referencedViews: data.referencedViews,
        sql: data.sql,
        ast: data.ast,
        gate,
        offendingNodeId,
        version: job.version,
        ms: data.ms,
      })
    }
  }

  private handleFatal(message: string) {
    for (const [, job] of this.pending) {
      clearTimeout(job.timer)
      job.reject(new Error(message))
    }
    this.pending.clear()
    if (this.restarts < MAX_RESTARTS) {
      this.restarts += 1
      this.worker?.terminate()
      this.spawn()
    } else {
      this.worker?.terminate()
      this.worker = null
      this.setStatus({ kind: 'unavailable', reason: message })
    }
  }

  /** Judge one query. Resolves with the real, live verdict, or rejects with
   * `not judged · the parser took too long` if the 1.5 s watchdog fires. */
  judge(sql: string, version: ValidatorVersion): Promise<JudgeResult> {
    if (!this.worker) return Promise.reject(new Error('validator unavailable · recorded verdicts only'))
    const id = this.nextId++
    return new Promise<JudgeResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('not judged · the parser took too long'))
        this.handleFatal('watchdog: parser exceeded 1500ms, restarting')
      }, WATCHDOG_MS)
      this.pending.set(id, { resolve, reject, timer, sql, version, startedAt: performance.now() })
      this.worker!.postMessage({ kind: 'judge', id, sql, version })
    })
  }

  /** Re-judges the full recorded corpus/questions/demos and reports k/n
   * agreement. The ledger only ever says LIVE once this hits 100%. */
  async runParityCheck(cases: { sql: string; currentOk: boolean; currentReason: string; currentGate: number | null }[]): Promise<{ ok: number; total: number }> {
    let ok = 0
    for (const c of cases) {
      try {
        const r = await this.judge(c.sql, 'current')
        if (r.ok === c.currentOk && r.reason === c.currentReason && r.gate === c.currentGate) ok += 1
      } catch {
        // watchdog/crash counts as a mismatch
      }
    }
    const result = { ok, total: cases.length }
    if (this.status.kind === 'live') {
      this.setStatus({ kind: 'live', parity: result, sha: this.shaCurrent })
    }
    return result
  }
}

export const validatorClient = new ValidatorClient()

/** responsive-spec.md: the 390px spine defers the ~16MB Pyodide payload
 * until the visitor opens the console; >=600px starts it at intro frame 0.
 * Once anything has started the worker, every component is free to go
 * live regardless of width. Components that mount eagerly in the DOM
 * (Inspector, Builder, Breach -- this site doesn't use a tab/sheet model
 * that would mount them lazily) check this before touching `.ready`, so a
 * narrow viewport falls back to RECORDED fixture data until the Console
 * is opened. */
export function shouldAutoStartValidator(): boolean {
  if (validatorClient.started) return true
  return typeof window === 'undefined' || window.innerWidth >= 600
}
