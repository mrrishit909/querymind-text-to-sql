// Ported, by hand, from scripts/verdict_glue.py's GATES / classify_gate.
// Kept deliberately dumb (string-prefix match) so it can never disagree
// with the Python source it mirrors. Do NOT "fix" the gate-8 (||) mismatch
// below -- it is a real quirk of the real reason string and the real
// prefix table, and attack_corpus.json was generated with this exact bug,
// so a "corrected" port would desync from the fixtures and silently break
// parity. See the handoff report for the finding.
//
// sql_validator.py line ~141: "the || concatenation operator is not allowed"
// verdict_glue.py line 32 prefix: "concatenation operator is not allowed"
// "the || ...".startsWith("concatenation ...") is false, so the || case
// legitimately classifies to gate `null` under the real Python glue too.

export interface GateDef {
  id: number
  title: string
  reasonPrefix: string[]
}

export const GATES: GateDef[] = [
  { id: 1, title: 'Empty input', reasonPrefix: ['empty SQL'] },
  { id: 2, title: 'Must parse as SQL', reasonPrefix: ['SQL did not parse'] },
  { id: 3, title: 'Exactly one statement', reasonPrefix: ['expected exactly 1 statement'] },
  { id: 4, title: 'Must be SELECT or CTE', reasonPrefix: ['only SELECT/CTE statements are allowed'] },
  { id: 5, title: 'No DDL/DML anywhere in the tree', reasonPrefix: ['disallowed statement type in query'] },
  { id: 6, title: 'No SELECT INTO / FOR UPDATE / FOR SHARE', reasonPrefix: ['SELECT ... INTO', 'FOR UPDATE/FOR SHARE'] },
  { id: 7, title: 'Function allowlist (default-deny)', reasonPrefix: ['disallowed function'] },
  { id: 8, title: 'No window functions / no || operator', reasonPrefix: ['window functions are not allowed', 'concatenation operator is not allowed'] },
  { id: 9, title: 'No nested WITH / WITH RECURSIVE', reasonPrefix: ['nested WITH clauses', 'WITH RECURSIVE'] },
  { id: 10, title: 'CTE bodies may only reference approved views or earlier CTEs', reasonPrefix: ['unapproved table/view referenced'] },
  { id: 11, title: 'Main query may only reference approved views or any CTE', reasonPrefix: ['unapproved table/view referenced'] },
]

// Upstream of G1: Claude can decline before any SQL exists. Not a real gate
// in sql_validator.py -- drawn dashed, per art-direction.md.
export const LLM_GATE_ID = 0

export function classifyGate(reason: string): number | null {
  for (const gate of GATES) {
    if (gate.reasonPrefix.some((p) => reason.startsWith(p))) return gate.id
  }
  return null
}

export const DEPTH_LAYERS = [
  { title: 'Read-only transaction', evidence: 'db/connection.py' },
  { title: 'Role grants (5 views only)', evidence: 'test_direct_select_on_base_table_rejected_by_grants' },
  { title: 'RLS on base tables', evidence: 'test_rls_blocks_even_with_an_accidental_grant' },
  { title: 'statement_timeout 3 s', evidence: 'test_statement_timeout_fires_on_a_validator_accepted_slow_query' },
]
