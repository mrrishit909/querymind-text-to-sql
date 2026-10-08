import { useEffect, useMemo, useState } from 'react'
import type { GridEntry } from '../data/fixtures'
import { parseGridKey } from '../data/fixtures'
import { validatorClient, shouldAutoStartValidator } from '../worker/validatorClient'
import type { JudgeResult } from '../lib/types'
import { ResultView } from './ResultView'
import type { GauntletState } from './Gauntlet'

export function Builder({ grid, onSlugChange }: { grid: GridEntry[]; onSlugChange: (s: GauntletState) => void }) {
  const parsed = useMemo(() => grid.map((e) => ({ entry: e, chips: parseGridKey(e.measure) })), [grid])
  const dimensions = useMemo(() => Array.from(new Set(parsed.map((p) => p.chips.dimension))), [parsed])
  const [dimension, setDimension] = useState(dimensions[0])
  const aggregatesForDim = useMemo(() => Array.from(new Set(parsed.filter((p) => p.chips.dimension === dimension).map((p) => p.chips.aggregate))), [parsed, dimension])
  const [aggregate, setAggregate] = useState(aggregatesForDim[0])
  const statusesForCombo = useMemo(
    () => Array.from(new Set(parsed.filter((p) => p.chips.dimension === dimension && p.chips.aggregate === aggregate).map((p) => p.chips.statusFilter ?? 'all'))),
    [parsed, dimension, aggregate],
  )
  const [status, setStatus] = useState(statusesForCombo[0])

  useEffect(() => {
    if (!aggregatesForDim.includes(aggregate)) setAggregate(aggregatesForDim[0])
  }, [aggregatesForDim, aggregate])
  useEffect(() => {
    if (!statusesForCombo.includes(status)) setStatus(statusesForCombo[0])
  }, [statusesForCombo, status])

  const match = parsed.find(
    (p) => p.chips.dimension === dimension && p.chips.aggregate === aggregate && (p.chips.statusFilter ?? 'all') === status,
  )

  const [live, setLive] = useState<JudgeResult | null>(null)
  useEffect(() => {
    if (!match) return
    if (!shouldAutoStartValidator()) {
      onSlugChange({ phase: 'judged', sql: match.entry.sql, ok: true, reason: '', gate: null, isLive: false })
      return
    }
    validatorClient.ready.then(() =>
      validatorClient.judge(match.entry.sql, 'current').then((r) => {
        setLive(r)
        onSlugChange({ phase: 'judged', sql: r.sql || match.entry.sql, ok: r.ok, reason: r.reason, gate: r.gate, isLive: true })
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.entry.measure])

  return (
    <div>
      <div className="chip-row" role="group" aria-label="dimension">
        {dimensions.map((d) => (
          <button key={d} type="button" className={`chip ${d === dimension ? 'active' : ''}`} onClick={() => setDimension(d)}>{d}</button>
        ))}
      </div>
      <div className="chip-row" role="group" aria-label="measure">
        {Array.from(new Set(parsed.map((p) => p.chips.aggregate))).map((a) => (
          <button
            key={a}
            type="button"
            disabled={!aggregatesForDim.includes(a)}
            className={`chip ${a === aggregate ? 'active' : ''}`}
            onClick={() => setAggregate(a)}
          >
            {a}
          </button>
        ))}
      </div>
      <div className="chip-row" role="group" aria-label="status filter">
        {['all', 'completed', 'cancelled', 'returned'].map((s) => (
          <button
            key={s}
            type="button"
            disabled={!statusesForCombo.includes(s)}
            className={`chip ${s === status ? 'active' : ''}`}
            onClick={() => setStatus(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {match ? (
        <div className="sql-block mono" style={{ marginBottom: 12 }}>{live?.sql || match.entry.sql}</div>
      ) : (
        <div className="not-precomputed">not precomputed</div>
      )}

      {match && (
        <ResultView
          columns={['dim', 'value']}
          rows={match.entry.rows}
          ordered={dimension === 'month'}
          caption="executed against Postgres as querymind_reader at fixture time"
        />
      )}
    </div>
  )
}
