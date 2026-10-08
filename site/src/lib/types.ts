export type ValidatorVersion = 'current' | 'prefix'

export interface AstNode {
  id: number
  parent_id: number | null
  cls: string
  label: string | null
  db: string | null
  stmt: number
}

export interface AstInfo {
  parsed: boolean
  error: string | null
  nodes: AstNode[]
  statement_count: number
}

export interface JudgeResult {
  ok: boolean
  reason: string
  referencedViews: string[]
  sql: string
  ast: AstInfo
  gate: number | null
  offendingNodeId: number | null
  version: ValidatorVersion
  ms: number
}

export interface JudgeRequest {
  id: number
  sql: string
  version: ValidatorVersion
}

export type WorkerOutMessage =
  | { kind: 'progress'; pct: number; stage: string }
  | { kind: 'ready'; sha: Record<string, string> }
  | { kind: 'error'; message: string }
  | { kind: 'result'; id: number; result: JudgeResult }
