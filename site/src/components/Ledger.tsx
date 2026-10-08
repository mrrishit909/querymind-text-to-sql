import type { EngineStatus } from '../worker/validatorClient'

export function Ledger({ status, onReplayIntro }: { status: EngineStatus; onReplayIntro: () => void }) {
  return (
    <div className="ledger">
      <span className="status">
        {status.kind === 'loading' && <>validator · loading {status.pct}% · {status.stage}</>}
        {status.kind === 'live' && status.parity.total > 0 && status.parity.ok === status.parity.total && (
          <>
            <span className="live-dot" aria-hidden="true" /> validator · parity {status.parity.ok}/{status.parity.total} · LIVE · sha {status.sha.slice(0, 8)}
          </>
        )}
        {status.kind === 'live' && (status.parity.total === 0 || status.parity.ok < status.parity.total) && (
          <>validator · {status.parity.total === 0 ? 'running proof run…' : `parity ${status.parity.ok}/${status.parity.total} · showing recorded verdicts`} · sha {status.sha.slice(0, 8)}</>
        )}
        {status.kind === 'unavailable' && <>validator · unavailable · recorded verdicts only</>}
      </span>
      <button type="button" onClick={onReplayIntro}>Replay intro</button>
    </div>
  )
}
