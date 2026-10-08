// Loaders + types for site/public/data/*.json. Read-only: this file never
// writes those fixtures, only shapes what's already there (per task brief,
// §15). Types match the actual files on disk, not the aspirational shapes
// described in design/concepts/selection.md "known gaps".

export interface Question {
  category: string
  question: string
  sql: string
  safety_status: 'validated' | 'llm_declined'
  assumptions: string
  reason: string
  columns: string[]
  rows: Record<string, unknown>[]
  row_count: number
  answer: string
  cost_usd: number
}

export interface QuestionsFile {
  model: string
  total_cost_usd: number
  questions: Question[]
}

export interface SecurityDemo {
  label: string
  sql: string
  validator_result: 'accepted' | 'rejected'
  reason: string
  row_count: number
  rows: Record<string, unknown>[]
  columns: string[]
}

export interface SchemaCatalog {
  approved_views: string[]
  catalog_text: string
}

export interface GridEntry {
  measure: string
  sql: string
  rows: { dim: string; value: number }[]
}

export interface CorpusGate {
  id: number
  title: string
  reason_prefix: string | string[]
}

export interface CorpusCase {
  sql: string
  current_ok: boolean
  current_reason: string
  current_gate: number | null
  prefix_ok: boolean
  prefix_reason: string
  prefix_gate: number | null
  is_the_fixed_bypass: boolean
}

export interface AttackCorpus {
  gates: CorpusGate[]
  cases: CorpusCase[]
  bypass_count: number
}

export interface BreachEvidenceEntry {
  label: string
  api_response: {
    question: string
    sql: string
    safety_status: string
    reason: string
    columns: string[]
    rows: Record<string, unknown>[]
    row_count: number
    answer: string
    cost_usd: number | null
    latency_s: number | null
  }
}

export interface Fixtures {
  questions: QuestionsFile
  demos: SecurityDemo[]
  schema: SchemaCatalog
  grid: GridEntry[]
  corpus: AttackCorpus
  breach: BreachEvidenceEntry[]
}

const base = import.meta.env.BASE_URL

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}data/${path}`)
  if (!res.ok) throw new Error(`data unavailable: ${path}`)
  return res.json() as Promise<T>
}

export async function loadFixtures(): Promise<Fixtures> {
  const [questions, demos, schema, grid, corpus, breach] = await Promise.all([
    getJson<QuestionsFile>('questions.json'),
    getJson<SecurityDemo[]>('security_demos.json'),
    getJson<SchemaCatalog>('schema_catalog.json'),
    getJson<GridEntry[]>('query_builder_grid.json'),
    getJson<AttackCorpus>('attack_corpus.json'),
    getJson<BreachEvidenceEntry[]>('breach_evidence.json'),
  ])
  return { questions, demos, schema, grid, corpus, breach }
}

/** Builder chip parsing: derive dimension / aggregate / status-filter from
 * the 16 real `measure` keys instead of hard-coding them, so the UI can
 * never offer a combination the grid lacks. */
export interface BuilderChipSet {
  key: string
  dimension: string
  aggregate: string
  statusFilter: string | null
}

export function parseGridKey(measure: string): BuilderChipSet {
  const STATUS = ['completed', 'cancelled', 'returned']
  const status = STATUS.find((s) => measure.endsWith(`_${s}`))
  const withoutStatus = status ? measure.slice(0, -(status.length + 1)) : measure
  const DIMENSIONS = ['by_city', 'by_category', 'by_status', 'by_month', 'by_product_top5', 'by_product_top10', 'by_product_top20']
  const dim = DIMENSIONS.find((d) => withoutStatus.endsWith(d)) ?? withoutStatus
  const aggregate = dim === withoutStatus ? withoutStatus : withoutStatus.slice(0, -(dim.length + 1))
  return { key: measure, dimension: dim.replace(/^by_/, ''), aggregate: aggregate || 'count', statusFilter: status ?? null }
}
