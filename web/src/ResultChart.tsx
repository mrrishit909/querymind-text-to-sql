import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

/** Bar chart for result rows: picks the first non-numeric column as the
 * category axis and the first numeric column as the value. Returns null
 * when the result doesn't group well as a chart (a single scalar row, or
 * no numeric column to plot). */
export default function ResultChart({ columns, rows }: { columns: string[]; rows: Record<string, unknown>[] }) {
  if (rows.length < 2) return null // a single scalar result doesn't need a chart

  const isNumeric = (c: string) => rows.every((r) => typeof r[c] === 'number')
  const numericCol = columns.find(isNumeric)
  const categoryCol = columns.find((c) => c !== numericCol)
  if (!numericCol || !categoryCol) return null

  const data = rows.slice(0, 20).map((r) => ({
    [categoryCol]: String(r[categoryCol]),
    [numericCol]: r[numericCol] as number,
  }))

  return (
    <div className="h-56 w-full" role="img" aria-label={`Bar chart of ${numericCol} by ${categoryCol}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#25313B" />
          <XAxis dataKey={categoryCol} stroke="#DCE1E6" tick={{ fill: '#DCE1E6', fontSize: 11 }} />
          <YAxis stroke="#DCE1E6" tick={{ fill: '#DCE1E6', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#0D1015', border: '1px solid #25313B', color: '#DCE1E6' }}
            labelStyle={{ color: '#DCE1E6' }}
          />
          <Bar dataKey={numericCol} fill="#416CFF" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
