import { useEffect, useRef, useState } from 'react'
import { GATES, DEPTH_LAYERS } from '../lib/gates'

export interface GauntletState {
  /** 'idle': nothing has been judged yet. 'llm-decline': never reached G1.
   * 'judged': ok/gate below apply. */
  phase: 'idle' | 'llm-decline' | 'judged'
  sql: string
  ok: boolean | null
  reason: string
  gate: number | null
  offendingNodeLabel?: string | null
  isLive: boolean
  declineText?: string
  /** Breach choreography only: which gate currently shows the historical
   * hole in its hairline. */
  breachOpenGate?: number | null
  showDepth?: boolean
}

const TOTAL_SLOTS = 12 // LLM gate (0) + G1..G11 (1..11)

export function Gauntlet({ state }: { state: GauntletState }) {
  const [verdictToken, setVerdictToken] = useState(0)
  const prevKey = useRef<string>('')

  useEffect(() => {
    const key = `${state.phase}:${state.gate}:${state.ok}:${state.sql}`
    if (key !== prevKey.current) {
      prevKey.current = key
      setVerdictToken((t) => t + 1)
    }
  }, [state.phase, state.gate, state.ok, state.sql])

  const stopIndex = state.phase === 'llm-decline' ? 0 : state.ok ? TOTAL_SLOTS : state.gate ?? TOTAL_SLOTS
  const leftPct = (stopIndex / TOTAL_SLOTS) * 100
  const rejected = state.phase === 'judged' && state.ok === false

  return (
    <div className="gauntlet-track" role="img" aria-label={gauntletAriaLabel(state)}>
      <div className={`gate llm-gate ${state.phase === 'llm-decline' ? 'flare' : ''}`}>
        <span className="gate-label" title="Claude can decline before any SQL exists">LLM</span>
      </div>
      {GATES.map((g) => {
        const passed = state.phase === 'judged' && (state.ok ? true : state.gate !== null && g.id < state.gate)
        const flaring = rejected && state.gate === g.id
        const open = state.breachOpenGate === g.id
        return (
          <div
            key={g.id}
            className={`gate ${passed ? 'tick-pass' : ''} ${flaring ? 'flare' : ''} ${open ? 'breach-open' : ''}`}
          >
            <span className="gate-label" title={g.title}>G{g.id}</span>
          </div>
        )
      })}
      {state.showDepth &&
        DEPTH_LAYERS.map((d, i) => (
          <div key={d.title} className="gate depth-gate">
            <span className="gate-label" title={d.title}>D{i + 1}</span>
          </div>
        ))}

      {state.phase !== 'idle' && (
        <div className="slug" style={{ left: `${leftPct}%` }}>
          {rejected && state.offendingNodeLabel && (
            <div className="offending-node">{state.offendingNodeLabel}</div>
          )}
          <div className={`slug-body ${rejected ? 'rejected' : ''} ${state.ok ? 'passed' : ''}`}>
            {state.phase === 'llm-decline' ? (state.declineText ?? 'declined by Claude') : state.sql}
          </div>
          {rejected && <div className="reason">{state.reason}</div>}
        </div>
      )}

      <div className="visually-hidden" role="status" aria-live="polite">
        {verdictStatusText(state)}
      </div>
      {state.isLive && <span key={verdictToken} className="live-dot pulse visually-hidden" aria-hidden="true" />}
    </div>
  )
}

function gauntletAriaLabel(state: GauntletState): string {
  if (state.phase === 'idle') return 'The gauntlet: eleven real validator gates, no query loaded yet'
  if (state.phase === 'llm-decline') return 'Claude declined before the validator gates were reached'
  return state.ok ? 'Query passed all eleven gates' : `Query stopped at gate ${state.gate}`
}

function verdictStatusText(state: GauntletState): string {
  if (state.phase === 'idle') return ''
  if (state.phase === 'llm-decline') return 'Declined by Claude. The validator never had to decide.'
  if (state.ok) return 'Accepted. Not executed: static site.'
  return `Rejected at gate ${state.gate}. ${state.reason}`
}
