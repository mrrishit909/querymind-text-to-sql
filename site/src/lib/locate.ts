import type { AstInfo } from './types'

// Where in the AST a rejection's offending node lives, by gate. Mirrors the
// table in design/approved/interaction-map.md "offending_node_id". A few
// gates (1 parse, 2 statement-count-adjacent, 6 into/locks) are left
// unlocated here -- the AST dump this site builds (src/worker/qm_glue.py)
// doesn't carry the `into`/`locks` flags or a second statement tree, so for
// those the UI shows the reason text with no node highlight rather than
// guessing. ponytail: narrow the AST dump to add those flags if a reviewer
// wants G6 highlighted too.
export function locateOffendingNode(ast: AstInfo, reason: string, gate: number | null): number | null {
  if (!ast?.parsed || !ast.nodes?.length || gate === null) return null
  const nodes = ast.nodes

  if (gate === 10 || gate === 11) {
    const name = reason.split(':').pop()?.trim()
    const hit = nodes.find((n) => n.cls === 'Table' && n.label === name)
    return hit ? hit.id : null
  }
  if (gate === 7) {
    const name = reason.split(':').pop()?.trim()
    const hit = nodes.find((n) => n.label === name && n.cls !== 'Table' && n.cls !== 'Column')
    return hit ? hit.id : null
  }
  if (gate === 8) {
    const hit = nodes.find((n) => n.cls === 'Window' || n.cls === 'DPipe')
    return hit ? hit.id : null
  }
  if (gate === 9) {
    const hit = nodes.find((n) => n.cls === 'With')
    return hit ? hit.id : null
  }
  if (gate === 5) {
    const forbidden = new Set(['Insert', 'Update', 'Delete', 'Drop', 'Alter', 'Create', 'TruncateTable', 'Copy', 'Attach', 'Pragma', 'Command', 'Merge'])
    const hit = nodes.find((n) => forbidden.has(n.cls))
    return hit ? hit.id : null
  }
  if (gate === 4) {
    const hit = nodes.find((n) => n.parent_id === null && n.stmt === 0)
    return hit ? hit.id : null
  }
  if (gate === 3) {
    const hit = nodes.find((n) => n.parent_id === null && n.stmt === 1)
    return hit ? hit.id : null
  }
  return null
}
