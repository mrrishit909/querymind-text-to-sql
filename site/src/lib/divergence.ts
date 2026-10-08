import type { AstInfo } from './types'

export type DivergenceClass = 'breach' | 'silver' | 'dim'

export interface Divergence {
  cls: DivergenceClass
  label: string
}

/** colors.md rule 3's three-way split of a before/current divergence (the
 * old validator accepted, the current one rejects). Breach-red is rationed
 * to the exact leaked class: a pg_catalog/information_schema table
 * reference at the table-scope gate. */
export function classifyDivergence(currentGate: number | null, ast: AstInfo | null, offendingNodeId: number | null): Divergence {
  if ((currentGate === 10 || currentGate === 11) && ast && offendingNodeId !== null) {
    const node = ast.nodes.find((n) => n.id === offendingNodeId)
    if (node?.db === 'pg_catalog' || node?.db === 'information_schema') {
      return { cls: 'breach', label: 'same class as the recorded leak' }
    }
    return { cls: 'silver', label: 'would have reached the database · role grants decide' }
  }
  if (currentGate === 8) {
    return { cls: 'dim', label: 'outside the documented surface · no data escape (audit)' }
  }
  return { cls: 'dim', label: 'diverges before/after' }
}

export function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim()
}
