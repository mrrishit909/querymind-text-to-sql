import { useEffect, useState } from 'react'
import { loadFixtures } from './data/fixtures'
import type { Fixtures, Question } from './data/fixtures'
import { validatorClient, shouldAutoStartValidator } from './worker/validatorClient'
import type { EngineStatus } from './worker/validatorClient'
import { classifyGate } from './lib/gates'
import type { JudgeResult } from './lib/types'
import { Gauntlet } from './components/Gauntlet'
import type { GauntletState } from './components/Gauntlet'
import { Ledger } from './components/Ledger'
import { Explorer } from './components/Explorer'
import { Inspector } from './components/Inspector'
import { ResultView } from './components/ResultView'
import { Builder } from './components/Builder'
import { SecurityDemos } from './components/SecurityDemos'
import { Console } from './components/Console'
import { Breach } from './components/Breach'
import { Intro } from './components/Intro'
import { DEPTH_LAYERS } from './lib/gates'

const BEATS = ['hero', 'ask', 'shape', 'build', 'judge', 'breach', 'depth', 'ledger'] as const

function App() {
  const [fixtures, setFixtures] = useState<Fixtures | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [engineStatus, setEngineStatus] = useState<EngineStatus>(validatorClient.getStatus())
  const [introDone, setIntroDone] = useState(false)
  const [selected, setSelected] = useState<Question | null>(null)
  const [bandState, setBandState] = useState<GauntletState>({ phase: 'idle', sql: '', ok: null, reason: '', gate: null, isLive: false })
  const [liveMatched, setLiveMatched] = useState<Set<string>>(new Set())
  const [consoleSeed, setConsoleSeed] = useState<string | undefined>(undefined)

  useEffect(() => {
    loadFixtures()
      .then((f) => {
        setFixtures(f)
        setSelected(f.questions.questions[0])
      })
      .catch((e) => setLoadError(e.message))
  }, [])

  useEffect(() => validatorClient.onStatus(setEngineStatus), [])

  // The proof run: once the worker is ready, judge every recorded query and
  // only claim LIVE at 100% agreement (interaction-map.md "Parity").
  useEffect(() => {
    if (!fixtures) return
    // Desktop/tablet (>=600px) start the worker at frame 0, per
    // scroll-storyboard.md. The 390px spine defers Pyodide entirely until
    // the visitor opens the console (responsive-spec.md), so this proof
    // run -- and the ~16MB fetch it would trigger -- is skipped there.
    if (!shouldAutoStartValidator()) return
    let cancelled = false
    validatorClient.ready.then(async () => {
      const cases = [
        ...fixtures.questions.questions
          .filter((q) => q.safety_status === 'validated')
          .map((q) => ({ sql: q.sql, currentOk: true, currentReason: '', currentGate: null })),
        ...fixtures.demos.map((d) => ({
          sql: d.sql,
          currentOk: d.validator_result === 'accepted',
          currentReason: d.reason,
          currentGate: d.validator_result === 'accepted' ? null : classifyGate(d.reason),
        })),
        ...fixtures.corpus.cases.map((c) => ({ sql: c.sql, currentOk: c.current_ok, currentReason: c.current_reason, currentGate: c.current_gate })),
      ]
      const matched = new Set<string>()
      for (const q of fixtures.questions.questions) {
        if (q.safety_status !== 'validated') continue
        try {
          const r = await validatorClient.judge(q.sql, 'current')
          if (r.ok && r.reason === '') matched.add(q.question)
        } catch {
          // not matched
        }
      }
      if (!cancelled) setLiveMatched(matched)
      await validatorClient.runParityCheck(cases)
    })
    return () => { cancelled = true }
  }, [fixtures])

  // After the intro (or on question selection), judge the selected
  // question live and park its slug in the band.
  useEffect(() => {
    if (!selected || selected.safety_status === 'llm_declined') {
      if (selected) {
        setBandState({ phase: 'llm-decline', sql: '', ok: null, reason: '', gate: null, isLive: false, declineText: selected.assumptions })
      }
      return
    }
    if (!shouldAutoStartValidator()) {
      setBandState({ phase: 'judged', sql: selected.sql, ok: selected.safety_status === 'validated', reason: selected.reason, gate: null, isLive: false })
      return
    }
    validatorClient.ready
      .then(() => validatorClient.judge(selected.sql, 'current'))
      .then((r) => setBandState({ phase: 'judged', sql: r.sql || selected.sql, ok: r.ok, reason: r.reason, gate: r.gate, isLive: true }))
      .catch(() =>
        setBandState({ phase: 'judged', sql: selected.sql, ok: selected.safety_status === 'validated', reason: selected.reason, gate: null, isLive: false }),
      )
  }, [selected])

  const q1 = fixtures?.questions.questions[0]
  const [introLiveQ1, setIntroLiveQ1] = useState<JudgeResult | null>(null)
  useEffect(() => {
    if (!q1) return
    if (!shouldAutoStartValidator()) return
    validatorClient.ready.then(() => validatorClient.judge(q1.sql, 'current')).then(setIntroLiveQ1).catch(() => {})
  }, [q1])

  const [currentBeat, setCurrentBeat] = useState<string>('hero')
  useEffect(() => {
    if (!introDone) return
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setCurrentBeat(e.target.id)),
      { threshold: 0.3 },
    )
    BEATS.forEach((id) => {
      const el = document.getElementById(id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [introDone])

  if (loadError) return <p className="dim" style={{ padding: 24 }}>data unavailable: {loadError}</p>
  if (!fixtures || !selected) return <p className="dim" style={{ padding: 24 }}>loading…</p>

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      {!introDone && q1 && <Intro q1={q1} live={introLiveQ1} onDone={() => setIntroDone(true)} />}

      <header className="topbar">
        <span className="logo claim">QUERYMIND</span>
        <nav aria-label="beats">
          {BEATS.filter((b) => b !== 'hero').map((b) => (
            <a key={b} href={`#${b}`} aria-current={currentBeat === b}>{b[0].toUpperCase() + b.slice(1)}</a>
          ))}
        </nav>
      </header>

      <div className="band" id="hero">
        <div className="zone-language">
          <p className="human" style={{ fontSize: 15 }}>{selected.question}</p>
        </div>
        <Gauntlet state={bandState} />
        <div className="zone-data">
          {bandState.ok && !bandState.reason && selected.safety_status === 'validated' && (
            <ResultView columns={selected.columns} rows={selected.rows} />
          )}
        </div>
      </div>

      <main id="main">
        <section className="deck" id="ask" aria-labelledby="ask-h">
          <h2 id="ask-h" className="claim">Twelve real questions.</h2>
          <Explorer questions={fixtures.questions.questions} selected={selected} liveMatched={liveMatched} onSelect={setSelected} />
          <h3 style={{ marginTop: 24 }}>SQL Inspector</h3>
          <Inspector question={selected} schema={fixtures.schema} />
          <p className="dim" style={{ fontSize: 12 }}>
            Claude only saw these five views. The validator only allows these five views. The database role can only read these five views.
          </p>
        </section>

        <section className="deck" id="shape" aria-labelledby="shape-h">
          <h2 id="shape-h" className="claim">Rows become pictures, and stay rows.</h2>
          {selected.safety_status === 'validated' ? (
            <ResultView columns={selected.columns} rows={selected.rows} ordered={false} />
          ) : (
            <p className="dim">no SQL, no rows: Claude declined.</p>
          )}
        </section>

        <section className="deck" id="build" aria-labelledby="build-h">
          <h2 id="build-h" className="claim">Compose a question without words.</h2>
          <Builder grid={fixtures.grid} onSlugChange={setBandState} />
        </section>

        <section className="deck" id="judge" aria-labelledby="judge-h">
          <h2 id="judge-h" className="claim">Try to break it.</h2>
          <SecurityDemos
            demos={fixtures.demos}
            corpus={fixtures.corpus}
            onSlugChange={setBandState}
            onLoadIntoConsole={(sql) => setConsoleSeed(sql)}
          />
          <h3 style={{ marginTop: 24 }}>Console</h3>
          <Console fixtures={fixtures} engineStatus={engineStatus} onSlugChange={setBandState} initialSql={consoleSeed} />
        </section>

        <section className="deck" id="breach" aria-labelledby="breach-h">
          <h2 id="breach-h" className="claim">On 2026-10-08, one gate had a hole.</h2>
          <Breach breach={fixtures.breach} onSlugChange={setBandState} />
        </section>

        <section className="deck" id="depth" aria-labelledby="depth-h">
          <h2 id="depth-h" className="claim">The validator is layer one of five.</h2>
          <div className="explorer-grid">
            {DEPTH_LAYERS.map((d) => (
              <div key={d.title} className="exhibit">
                <p>{d.title}</p>
                <p className="mono dim" style={{ fontSize: 11 }}>proof: {d.evidence}</p>
              </div>
            ))}
          </div>
          <p className="dim" style={{ fontSize: 12, marginTop: 12 }}>
            A role can lower its own timeout with <code>SET statement_timeout = 0</code>. Through this app it can&apos;t, because the validator rejects any SET at gate 3. Type it into the console to see it stop, LIVE.
          </p>
        </section>

        <section className="deck" id="ledger" aria-labelledby="ledger-h">
          <h2 id="ledger-h" className="claim">Ledger</h2>
          <table className="result-table">
            <tbody>
              <tr><td>Questions</td><td className="mono">12 · validated {fixtures.questions.questions.filter((q) => q.safety_status === 'validated').length} · declined by Claude {fixtures.questions.questions.filter((q) => q.safety_status === 'llm_declined').length}</td></tr>
              <tr><td>Claude calls</td><td className="mono">12 · total ${fixtures.questions.total_cost_usd.toFixed(3)} · {fixtures.questions.model}</td></tr>
              <tr><td>Validator</td><td className="mono">sql_validator.py · sqlglot 30.21.0 · Pyodide · {engineStatus.kind === 'live' ? `parity ${engineStatus.parity.ok}/${engineStatus.parity.total}` : engineStatus.kind}</td></tr>
            </tbody>
          </table>
          <p>
            <a href="https://github.com/mrrishit909/querymind-text-to-sql">source repo</a> · <a href="../REQUIREMENTS_AUDIT.md">REQUIREMENTS_AUDIT.md</a> · <a href="../LIMITATIONS.md">LIMITATIONS.md</a>
          </p>
          <button type="button" onClick={() => { try { sessionStorage.removeItem('querymind.introSeen') } catch { /* noop */ } setIntroDone(false) }}>Replay intro</button>
        </section>
      </main>

      <Ledger status={engineStatus} onReplayIntro={() => { try { sessionStorage.removeItem('querymind.introSeen') } catch { /* noop */ } setIntroDone(false) }} />
    </>
  )
}

export default App
