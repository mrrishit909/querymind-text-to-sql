import { useMemo, useState } from 'react'
import type { AttackCorpus, SecurityDemo } from '../data/fixtures'
import { validatorClient } from '../worker/validatorClient'
import type { JudgeResult, ValidatorVersion } from '../lib/types'
import type { GauntletState } from './Gauntlet'
import { classifyDivergence } from '../lib/divergence'

export function SecurityDemos({
  demos,
  corpus,
  onSlugChange,
  onLoadIntoConsole,
}: {
  demos: SecurityDemo[]
  corpus: AttackCorpus
  onSlugChange: (s: GauntletState) => void
  onLoadIntoConsole: (sql: string) => void
}) {
  const [activeDemo, setActiveDemo] = useState<number | null>(null)
  const [liveByDemo, setLiveByDemo] = useState<Record<number, JudgeResult>>({})
  const [gateFilter, setGateFilter] = useState<number | 'all'>('all')
  const [divergentOnly, setDivergentOnly] = useState(false)
  const [matrixVersion, setMatrixVersion] = useState<ValidatorVersion>('current')
  const [liveMatrix, setLiveMatrix] = useState<Record<number, JudgeResult>>({})
  const [matrixLoading, setMatrixLoading] = useState(false)

  function runDemo(i: number) {
    setActiveDemo(i)
    const d = demos[i]
    validatorClient.ready.then(() =>
      validatorClient.judge(d.sql, 'current').then((r) => {
        setLiveByDemo((prev) => ({ ...prev, [i]: r }))
        onSlugChange({ phase: 'judged', sql: r.sql || d.sql, ok: r.ok, reason: r.reason, gate: r.gate, isLive: true })
      }),
    )
  }

  const filteredCases = useMemo(() => {
    return corpus.cases
      .map((c, i) => ({ ...c, idx: i }))
      .filter((c) => (gateFilter === 'all' ? true : c.current_gate === gateFilter || c.prefix_gate === gateFilter))
      .filter((c) => (divergentOnly ? c.prefix_ok && !c.current_ok : true))
  }, [corpus.cases, gateFilter, divergentOnly])

  async function rejudgeMatrixLive() {
    setMatrixLoading(true)
    await validatorClient.ready
    const next: Record<number, JudgeResult> = {}
    for (const c of filteredCases) {
      try {
        next[c.idx] = await validatorClient.judge(c.sql, matrixVersion)
      } catch {
        // leave unset; UI falls back to recorded
      }
    }
    setLiveMatrix(next)
    setMatrixLoading(false)
  }

  return (
    <div>
      <h3 style={{ fontSize: 16 }}>Six real demos</h3>
      <div className="demo-strip" role="list" tabIndex={0} aria-label="six demos, scrollable">
        {demos.map((d, i) => (
          <button
            key={d.label}
            type="button"
            role="listitem"
            className={`demo-card ${activeDemo === i ? 'active' : ''}`}
            onClick={() => runDemo(i)}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>{d.label}</div>
            <div className="mono dim" style={{ fontSize: 11 }}>{d.validator_result}</div>
            {liveByDemo[i] && (
              <div className="mono" style={{ fontSize: 11 }}>
                live: {liveByDemo[i].ok ? 'accepted' : `rejected G${liveByDemo[i].gate}`}
                {liveByDemo[i].ok !== (d.validator_result === 'accepted') && <span className="breach-color"> · mismatch vs recorded</span>}
              </div>
            )}
            {d.label.includes('catalog') || d.sql.includes('pg_catalog') ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); onLoadIntoConsole(d.sql) }} style={{ marginTop: 4, fontSize: 11 }}>
                this one used to get through →
              </button>
            ) : null}
          </button>
        ))}
      </div>

      <h3 style={{ fontSize: 16, marginTop: 24 }}>Corpus · {corpus.cases.length} recorded cases</h3>
      <div className="chip-row">
        <label className="dim" style={{ fontSize: 12 }}>
          gate{' '}
          <select value={gateFilter} onChange={(e) => setGateFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">all</option>
            {corpus.gates.map((g) => <option key={g.id} value={g.id}>G{g.id}</option>)}
          </select>
        </label>
        <button type="button" aria-pressed={divergentOnly} onClick={() => setDivergentOnly((v) => !v)}>show divergent only</button>
        <label className="dim" style={{ fontSize: 12 }}>
          version{' '}
          <select value={matrixVersion} onChange={(e) => setMatrixVersion(e.target.value as ValidatorVersion)}>
            <option value="current">current</option>
            <option value="prefix">before fix · reconstructed</option>
          </select>
        </label>
        <button type="button" onClick={rejudgeMatrixLive} disabled={matrixLoading}>{matrixLoading ? 're-judging…' : 'Re-judge live'}</button>
      </div>

      <div className="corpus-matrix" tabIndex={0} aria-label="corpus matrix, scrollable">
        <table>
          <caption className="visually-hidden">attack corpus, recorded and live verdicts by gate</caption>
          <thead>
            <tr>
              <th>sql</th>
              <th>current</th>
              <th>prefix (before)</th>
              <th>divergence</th>
            </tr>
          </thead>
          <tbody>
            {filteredCases.map((c) => {
              const live = liveMatrix[c.idx]
              const div = c.prefix_ok && !c.current_ok ? classifyDivergence(c.current_gate, live?.ast ?? null, live?.offendingNodeId ?? null) : null
              return (
                <tr key={c.idx} className={div ? `divergent-${div.cls}` : ''}>
                  <td className="sql-cell mono" onClick={() => onLoadIntoConsole(c.sql)} title="click to load into console">{c.sql}</td>
                  <td className={c.current_ok ? 'cell-pass' : 'cell-stop'}>{live && matrixVersion === 'current' ? (live.ok ? 'pass' : `G${live.gate ?? '?'}`) : c.current_ok ? 'pass' : `G${c.current_gate ?? '?'}`}</td>
                  <td className={c.prefix_ok ? 'cell-pass' : 'cell-stop'}>{live && matrixVersion === 'prefix' ? (live.ok ? 'pass' : `G${live.gate ?? '?'}`) : c.prefix_ok ? 'pass' : `G${c.prefix_gate ?? '?'}`}</td>
                  <td>{div ? div.label : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
