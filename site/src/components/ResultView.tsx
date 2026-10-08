import { useId, useState } from 'react'

type Row = Record<string, unknown>

export function ResultView({
  columns,
  rows,
  ordered = false,
  truncationNote,
  caption,
}: {
  columns: string[]
  rows: Row[]
  ordered?: boolean
  truncationNote?: string
  caption?: string
}) {
  const groupId = useId()
  const numericCols = columns.filter((c) => rows.length > 0 && typeof rows[0][c] === 'number')
  const labelCol = columns.find((c) => !numericCols.includes(c)) ?? columns[0]
  const valueCol = numericCols[0]
  const canBar = rows.length >= 2 && numericCols.length >= 1
  const canLine = canBar && ordered
  const [view, setView] = useState<'table' | 'bar' | 'line'>(canBar ? 'bar' : 'table')

  if (rows.length === 1 && columns.length === 1) {
    const col = columns[0]
    return (
      <div>
        <div className="big-number mono">{String(rows[0][col])}</div>
        <div className="dim" style={{ fontSize: 12 }}>{col}</div>
        <p className="dim" style={{ fontSize: 12 }}>One row, one number. A chart would only decorate it.</p>
      </div>
    )
  }

  const max = valueCol ? Math.max(...rows.map((r) => Number(r[valueCol]) || 0), 1) : 1

  return (
    <div>
      <div className="view-toggle" role="radiogroup" aria-label="result view">
        {(['table', 'bar', 'line'] as const).map((v) => {
          const disabled = (v === 'bar' && !canBar) || (v === 'line' && !canLine)
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              disabled={disabled}
              title={disabled ? (v === 'line' ? 'line view needs an ordered dimension' : 'needs 2+ rows with a numeric column') : undefined}
              onClick={() => setView(v)}
              className={view === v ? 'active' : ''}
            >
              {v}
            </button>
          )
        })}
      </div>

      {view === 'table' && (
        <table className="result-table" aria-describedby={truncationNote ? `${groupId}-trunc` : undefined}>
          <thead>
            <tr>{columns.map((c) => <th key={c} className={numericCols.includes(c) ? 'num' : ''}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.slice(0, 8).map((r, i) => (
              <tr key={i}>{columns.map((c) => <td key={c} className={numericCols.includes(c) ? 'num mono' : 'mono'}>{String(r[c])}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )}

      {view === 'bar' && valueCol && (
        <div>
          {rows.map((r, i) => {
            const v = Number(r[valueCol]) || 0
            return (
              <div className="bar-row" key={i}>
                <span className="label">{String(r[labelCol])}</span>
                <span className="track"><span className="fill" style={{ width: `${(v / max) * 100}%` }} /></span>
                <span className="value mono lime">{v.toLocaleString()}</span>
              </div>
            )
          })}
        </div>
      )}

      {view === 'line' && valueCol && (
        <LineChart rows={rows} labelCol={labelCol} valueCol={valueCol} />
      )}

      {rows.length > 8 && view === 'table' && (
        <p id={`${groupId}-trunc`} className="dim" style={{ fontSize: 12 }}>showing 8 of {rows.length} rows{truncationNote ? ` · ${truncationNote}` : ''}</p>
      )}
      {caption && <p className="dim" style={{ fontSize: 12 }}>{caption}</p>}
    </div>
  )
}

function LineChart({ rows, labelCol, valueCol }: { rows: Row[]; labelCol: string; valueCol: string }) {
  const w = 600
  const h = 200
  const pad = 30
  const values = rows.map((r) => Number(r[valueCol]) || 0)
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const points = values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / Math.max(max - min, 1)) * (h - pad * 2)
    return `${x},${y}`
  })
  return (
    <svg className="line-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`line chart of ${valueCol} by ${labelCol}`}>
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="var(--line)" />
      <polyline points={points.join(' ')} fill="none" stroke="var(--lime)" strokeWidth={2} />
      {points.map((p, i) => {
        const [x, y] = p.split(',')
        return <circle key={i} cx={x} cy={y} r={3} fill="var(--lime)" />
      })}
    </svg>
  )
}
