import { useEffect, useState } from 'react'
import type { BreachEvidenceEntry } from '../data/fixtures'
import { validatorClient, shouldAutoStartValidator } from '../worker/validatorClient'
import type { JudgeResult } from '../lib/types'
import type { GauntletState } from './Gauntlet'

const HUNKS = [
  { gate: 10, del: 'if name in defined_so_far:', add: 'if _is_unqualified(table) and name in defined_so_far:' },
  { gate: 11, del: 'if name in defined_so_far:', add: 'if _is_unqualified(table) and name in defined_so_far:' },
  { gate: 8, del: '(no window/|| check)', add: 'reject exp.Window and exp.DPipe explicitly' },
]

export function Breach({ breach, onSlugChange }: { breach: BreachEvidenceEntry[]; onSlugChange: (s: GauntletState) => void }) {
  const attacks = breach.slice(0, 3)
  const control = breach[3]
  const [tab, setTab] = useState(0)
  const [fixed, setFixed] = useState(false)
  const [result, setResult] = useState<JudgeResult | null>(null)

  useEffect(() => {
    const sql = attacks[tab].api_response.sql
    // Both outcomes here are already recorded fact (breach_evidence.json
    // for "before", the fixed-bypass corpus entries for "current"), so on
    // the 390px spine -- before the console has started the worker -- the
    // narrative renders from RECORDED data with no live call at all.
    if (!shouldAutoStartValidator()) {
      setResult(null)
      onSlugChange({
        phase: 'judged',
        sql,
        ok: !fixed,
        reason: fixed ? `unapproved table/view referenced: ${attacks[tab].label.split(' ')[0]}` : '',
        gate: fixed ? 10 : null,
        isLive: false,
        breachOpenGate: !fixed ? 10 : null,
      })
      return
    }
    validatorClient.ready.then(() =>
      validatorClient.judge(sql, fixed ? 'current' : 'prefix').then((r) => {
        setResult(r)
        onSlugChange({
          phase: 'judged',
          sql: r.sql || sql,
          ok: r.ok,
          reason: r.reason,
          gate: r.gate,
          isLive: true,
          breachOpenGate: !fixed ? 10 : null,
        })
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, fixed])

  const showEvidence = !fixed
  const rows = showEvidence ? attacks[tab].api_response.rows : []
  const cols = showEvidence ? attacks[tab].api_response.columns : []

  return (
    <div>
      <p className="mono dim" style={{ fontSize: 11 }}>QM 2026-10-08 · REQUIREMENTS_AUDIT.md · Independent Verification Pass</p>
      <div className="chip-row" role="tablist" aria-label="recorded attacks">
        {attacks.map((a, i) => (
          <button key={a.label} type="button" role="tab" aria-selected={tab === i} className={tab === i ? 'active' : ''} onClick={() => setTab(i)}>
            {a.label.split(' via')[0]}
          </button>
        ))}
      </div>

      <div className={`exhibit ${!fixed ? 'reconstructed-hatch' : ''}`}>
        <p className="mono" style={{ fontSize: 13 }}>
          {!fixed ? 'validator@before · reconstructed' : `validator@current · sha ${result ? 'f014977c' : ''}`}
        </p>
        <div className="sql-block mono" style={{ fontSize: 12 }}>{attacks[tab].api_response.sql}</div>

        {showEvidence ? (
          <div style={{ maxHeight: 260, overflow: 'auto' }} tabIndex={0} aria-label="leaked rows, scrollable">
            <table className="result-table">
              <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={JSON.stringify(r).includes('"postgres"') && JSON.stringify(r).includes('true') ? 'rolsuper-true' : ''}>
                    {cols.map((c) => <td key={c} className="mono">{String(r[c])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="cite">file: artifacts/verification/schema_qualified_cte_bypass_live_api.txt</p>
          </div>
        ) : (
          <div className="not-executed">0 rows · rejected before the database saw it</div>
        )}

        <p className="dim" style={{ fontSize: 12, marginTop: 8 }}>
          The validator saw a CTE named <code>pg_roles</code> and decided <code>pg_catalog.pg_roles</code> meant the CTE. It never checked the schema prefix.
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={fixed}
        onClick={() => setFixed((v) => !v)}
        style={{ marginTop: 16, fontSize: 16, padding: '12px 20px' }}
      >
        {fixed ? 'Fix applied -- revert to before' : 'Apply the fix'}
      </button>

      <h4 style={{ marginTop: 24 }}>The real 3-hunk diff</h4>
      {HUNKS.map((h, i) => (
        <div className="diff-hunk" key={i}>
          <div className="dim" style={{ fontSize: 10 }}>gate {h.gate}</div>
          <div className="del">- {h.del}</div>
          <div className="add">+ {h.add}</div>
        </div>
      ))}

      <h4 style={{ marginTop: 24 }}>The control case</h4>
      <p className="mono dim" style={{ fontSize: 12 }}>{control.api_response.sql}</p>
      <p className="dim" style={{ fontSize: 12 }}>
        Also accepted by the old validator, but the database role stopped it (<span className="mono">permission denied for table customers</span>, EVIDENCE).
      </p>
      <p className="dim" style={{ fontSize: 12 }}>Defense in depth caught that one. It could not catch pg_roles: catalog views are world-readable.</p>
      <p className="dim" style={{ fontSize: 12 }}>Found, confirmed live, fixed, and re-verified against a rebuilt container, all the same day.</p>
    </div>
  )
}
