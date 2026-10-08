import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { GATES, classifyGate } from '../../src/lib/gates'

const corpusPath = fileURLToPath(new URL('../../public/data/attack_corpus.json', import.meta.url))
const corpus = JSON.parse(readFileSync(corpusPath, 'utf-8')) as {
  gates: { id: number; title: string; reason_prefix: string | string[] }[]
  cases: { sql: string; current_ok: boolean; current_reason: string; current_gate: number | null }[]
}

describe('ported gate table', () => {
  it('matches attack_corpus.json gates exactly, including the gate-8 (||) reason-prefix mismatch', () => {
    for (const g of corpus.gates) {
      const prefixes = Array.isArray(g.reason_prefix) ? g.reason_prefix : [g.reason_prefix]
      const ported = GATES.find((x) => x.id === g.id)
      expect(ported, `gate ${g.id} missing from TS port`).toBeDefined()
      expect(ported!.reasonPrefix).toEqual(prefixes)
    }
  })

  it('classifyGate reproduces every recorded current_gate in the real attack corpus (56 cases)', () => {
    for (const c of corpus.cases) {
      if (c.current_ok) continue // accepted queries have no gate in the fixture
      const got = classifyGate(c.current_reason)
      expect(got, `sql: ${c.sql}\nreason: ${c.current_reason}`).toBe(c.current_gate)
    }
  })

  it('documents the known || reason-prefix mismatch: gate 8 fires, but classifyGate("the || ...") returns null', () => {
    const reason = 'the || concatenation operator is not allowed'
    expect(classifyGate(reason)).toBeNull()
  })
})
