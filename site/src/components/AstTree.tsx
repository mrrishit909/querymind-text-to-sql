import type { ReactNode } from 'react'
import type { AstInfo } from '../lib/types'

export function AstTree({ ast, offendingNodeId }: { ast: AstInfo; offendingNodeId?: number | null }) {
  if (!ast.parsed) return <p className="dim mono" style={{ fontSize: 12 }}>{ast.error}</p>
  const byParent = new Map<number | null, typeof ast.nodes>()
  for (const n of ast.nodes) {
    const arr = byParent.get(n.parent_id) ?? []
    arr.push(n)
    byParent.set(n.parent_id, arr)
  }
  const roots = byParent.get(null) ?? []

  function renderNode(id: number, depth: number): ReactNode {
    const node = ast.nodes.find((n) => n.id === id)
    if (!node) return null
    const children = byParent.get(node.id) ?? []
    return (
      <div key={id}>
        <div className={`node ${offendingNodeId === id ? 'hit' : ''}`} style={{ paddingLeft: depth * 12 }}>
          {node.cls}{node.label ? `(${node.label}${node.db ? ` db=${node.db}` : ''})` : ''}
        </div>
        {children.map((c) => renderNode(c.id, depth + 1))}
      </div>
    )
  }

  return (
    <div className="ast-tree" role="tree" aria-label="real sqlglot AST" tabIndex={0}>
      {roots.map((r) => renderNode(r.id, 0))}
      {ast.nodes.length >= 60 && <div className="dim" style={{ fontSize: 11 }}>+ more (capped at 60 nodes)</div>}
    </div>
  )
}
