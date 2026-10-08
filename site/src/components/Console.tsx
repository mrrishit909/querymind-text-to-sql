import { useEffect, useMemo, useRef, useState } from 'react'
import type { Fixtures } from '../data/fixtures'
import { validatorClient, shouldAutoStartValidator } from '../worker/validatorClient'
import type { EngineStatus } from '../worker/validatorClient'
import type { JudgeResult, ValidatorVersion } from '../lib/types'
import { normalizeSql } from '../lib/divergence'
import { AstTree } from './AstTree'
import type { GauntletState } from './Gauntlet'

const EXAMPLES = [
  { label: 'A legit query', sql: 'SELECT city, COUNT(*) AS n FROM v_customers GROUP BY city ORDER BY n DESC' },
  { label: 'The historical bypass', sql: "WITH pg_roles AS (SELECT 1 AS x FROM v_customers) SELECT rolname, rolsuper FROM pg_catalog.pg_roles" },
  { label: 'A DROP', sql: 'DROP TABLE customers' },
  { label: 'Multi-statement', sql: 'SELECT * FROM v_customers; DROP TABLE customers;' },
]

export function Console({
  fixtures,
  engineStatus,
  onSlugChange,
  initialSql,
}: {
  fixtures: Fixtures
  engineStatus: EngineStatus
  onSlugChange: (s: GauntletState) => void
  initialSql?: string
}) {
  const [text, setText] = useState(initialSql ?? EXAMPLES[0].sql)
  const [version, setVersion] = useState<ValidatorVersion>('current')
  const [result, setResult] = useState<JudgeResult | null>(null)
  const [statusText, setStatusText] = useState('')
  const [lastExample, setLastExample] = useState(text)
  const [started, setStarted] = useState(shouldAutoStartValidator())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const generation = useRef(0)

  const recorded = useMemo(() => {
    const entries: { sql: string; columns: string[]; rows: Record<string, unknown>[]; label: string }[] = []
    for (const q of fixtures.questions.questions) {
      if (q.safety_status === 'validated') entries.push({ sql: normalizeSql(q.sql), columns: q.columns, rows: q.rows, label: 'recorded execution of this exact SQL (question)' })
    }
    for (const d of fixtures.demos) {
      if (d.validator_result === 'accepted') entries.push({ sql: normalizeSql(d.sql), columns: d.columns, rows: d.rows, label: 'recorded execution of this exact SQL (demo)' })
    }
    for (const g of fixtures.grid) {
      entries.push({ sql: normalizeSql(g.sql), columns: ['dim', 'value'], rows: g.rows, label: 'recorded execution of this exact SQL (builder grid)' })
    }
    return entries
  }, [fixtures])

  const breachLookup = useMemo(
    () => fixtures.breach.map((b) => ({ sql: normalizeSql(b.api_response.sql), label: b.label, columns: b.api_response.columns, rows: b.api_response.rows })),
    [fixtures],
  )

  function runJudge(sql: string, v: ValidatorVersion) {
    const myGen = ++generation.current
    if (sql.length > 2000) {
      setStatusText('input capped at 2000 characters')
      return
    }
    validatorClient.ready
      .then(() => validatorClient.judge(sql, v))
      .then((r) => {
        if (myGen !== generation.current) return // stale, dropped
        setResult(r)
        onSlugChange({ phase: 'judged', sql: r.sql || sql, ok: r.ok, reason: r.reason, gate: r.gate, isLive: true, offendingNodeLabel: offendingLabel(r) })
        setStatusText(r.ok ? 'Accepted. Not executed: static site.' : `Rejected at gate ${r.gate ?? '?'}. ${r.reason}`)
      })
      .catch((e) => {
        if (myGen !== generation.current) return
        setStatusText(e.message)
      })
  }

  useEffect(() => {
    if (!started) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runJudge(text, version), 120)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, version, started])

  const engineDisabled = engineStatus.kind === 'unavailable'

  const matchedRecorded = result && result.ok ? recorded.find((e) => e.sql === normalizeSql(result.sql)) : null
  const matchedBreach = result && result.ok && version === 'prefix' ? breachLookup.find((b) => b.sql === normalizeSql(result.sql)) : null

  return (
    <div>
      <div className="chip-row" role="group" aria-label="validator version">
        <span id="version-label" className="dim" style={{ fontSize: 12 }}>validator version:</span>
        <button
          type="button"
          role="switch"
          aria-checked={version === 'prefix'}
          aria-labelledby="version-label"
          className={version === 'prefix' ? 'active' : ''}
          onClick={() => setVersion((v) => (v === 'current' ? 'prefix' : 'current'))}
        >
          {version === 'current' ? `current · sha ${engineStatus.kind === 'live' ? engineStatus.sha.slice(0, 8) : '…'}` : 'before fix · reconstructed'}
        </button>
      </div>

      {!started && (
        <button
          type="button"
          onClick={() => setStarted(true)}
          style={{ display: 'block', width: '100%', marginBottom: 8 }}
        >
          Load the validator · ~16 MB
        </button>
      )}

      <label htmlFor="console-input" className="visually-hidden">Type any SQL to judge it with the real validator</label>
      <textarea
        id="console-input"
        className="console-field"
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        disabled={engineDisabled || !started}
        maxLength={2000}
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            runJudge(text, version)
          }
        }}
      />
      <div className="chip-row" style={{ marginTop: 8 }}>
        <button type="button" onClick={() => setText(lastExample)}>Restore</button>
        {EXAMPLES.map((ex) => (
          <button key={ex.label} type="button" onClick={() => { setText(ex.sql); setLastExample(ex.sql) }}>{ex.label}</button>
        ))}
      </div>

      <div role="status" aria-live="polite" className="visually-hidden">{statusText}</div>

      {engineDisabled && (
        <p className="dim console-verdict">validator unavailable · recorded verdicts only. Try the demos and corpus below instead.</p>
      )}

      {result && (
        <div className="console-verdict">
          <p className={result.ok ? 'verdict-accept' : 'verdict-reject'}>
            {result.ok ? 'ACCEPTED' : `REJECTED at gate ${result.gate ?? '?'}`} ({version === 'current' ? `current · sha ${engineStatus.kind === 'live' ? engineStatus.sha.slice(0, 8) : ''}` : 'before fix · reconstructed'})
          </p>
          {!result.ok && <p className="dim">{result.reason}</p>}
          {result.ok && (
            <p className="dim" style={{ fontSize: 12 }}>
              Accepted by the validator. On the real server this would now run as <code>querymind_reader</code>, inside a read-only transaction with a 3-second timeout. It is not run here; this is a static site.
            </p>
          )}

          {result.ok && matchedRecorded && (
            <div>
              <p className="lime" style={{ fontSize: 12 }}>{matchedRecorded.label}</p>
              <table className="result-table"><thead><tr>{matchedRecorded.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>{matchedRecorded.rows.slice(0, 8).map((r, i) => <tr key={i}>{matchedRecorded.columns.map((c) => <td key={c} className="mono">{String(r[c])}</td>)}</tr>)}</tbody></table>
            </div>
          )}
          {result.ok && !matchedRecorded && version === 'current' && (
            <div className="not-executed">not executed · static site</div>
          )}
          {result.ok && version === 'prefix' && matchedBreach && (
            <div>
              <p className="breach-color" style={{ fontSize: 12 }}>EVIDENCE · {matchedBreach.label}</p>
              <table className="result-table"><thead><tr>{Object.keys(matchedBreach.rows[0] ?? {}).map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>{matchedBreach.rows.slice(0, 8).map((r, i) => <tr key={i} className={JSON.stringify(r).includes('"postgres"') ? 'rolsuper-true' : ''}>{Object.keys(r).map((c) => <td key={c} className="mono">{String(r[c])}</td>)}</tr>)}</tbody></table>
              <p className="dim" style={{ fontSize: 11 }}>file: artifacts/verification/schema_qualified_cte_bypass_live_api.txt</p>
            </div>
          )}
          {result.ok && version === 'prefix' && !matchedBreach && (
            <p className="dim" style={{ fontSize: 12 }}>would have reached the database · no recorded rows for this exact query</p>
          )}

          {result.ast && <AstTree ast={result.ast} offendingNodeId={result.offendingNodeId} />}
        </div>
      )}
    </div>
  )
}

function offendingLabel(r: JudgeResult): string | null {
  if (r.ok || r.offendingNodeId === null || !r.ast?.nodes) return null
  const n = r.ast.nodes.find((x) => x.id === r.offendingNodeId)
  if (!n) return null
  return `${n.cls}${n.label ? ` · ${n.label}` : ''}`
}
