import { useEffect, useRef, useState } from 'react'
import type { Question } from '../data/fixtures'
import { matchPhrases } from '../motion/intro'
import { prefersReducedMotion } from '../motion/config'
import { Gauntlet } from './Gauntlet'
import { ResultView } from './ResultView'
import type { JudgeResult } from '../lib/types'

const SKIP_KEY = 'querymind.introSeen'

export function Intro({ q1, live, onDone }: { q1: Question; live: JudgeResult | null; onDone: () => void }) {
  const reduced = prefersReducedMotion()
  const [frame, setFrame] = useState(0) // 0..7, reduced-motion: 0..3
  const [typed, setTyped] = useState('')
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const links = matchPhrases(q1.question, q1.sql, [])

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SKIP_KEY)) {
        onDone()
        return
      }
    } catch {
      // sessionStorage unavailable: just run the intro
    }
    if (reduced) return // advance on click/key instead, see below
    let i = 0
    const typeInterval = setInterval(() => {
      i += 1
      setTyped(q1.question.slice(0, i))
      if (i >= q1.question.length) clearInterval(typeInterval)
    }, 32)
    const schedule = [1400, 2600, 3800, 5200, 6400, 7600, 8800, 10200]
    schedule.forEach((t, idx) => {
      timers.current.push(setTimeout(() => setFrame(idx + 1), t))
    })
    timers.current.push(setTimeout(finish, 10200))
    return () => {
      clearInterval(typeInterval)
      timers.current.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish() {
    try {
      sessionStorage.setItem(SKIP_KEY, '1')
    } catch {
      // ignore
    }
    onDone()
  }

  function advanceReduced() {
    setFrame((f) => {
      if (f >= 3) {
        finish()
        return f
      }
      return f + 1
    })
  }

  useEffect(() => {
    if (!reduced) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') finish()
      else advanceReduced()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reduced])

  const gateFrame = reduced ? frame >= 2 : frame >= 4
  const tableFrame = reduced ? frame >= 2 : frame >= 5
  const barFrame = reduced ? frame >= 3 : frame >= 6

  return (
    <div
      className="intro-screen"
      role="dialog"
      aria-label="Introduction"
      onClick={reduced ? advanceReduced : undefined}
      onKeyDown={!reduced ? (e) => { if (e.key === 'Escape') finish() } : undefined}
    >
      <button type="button" className="intro-skip" onClick={(e) => { e.stopPropagation(); finish() }}>
        Skip
      </button>
      <div>
        <p className="intro-question" style={{ fontSize: 40 }}>
          {reduced ? renderLinked(q1.question, links) : frame < 1 ? typed : renderLinked(q1.question, links)}
        </p>

        {gateFrame && (
          <div style={{ marginTop: 24 }}>
            <Gauntlet
              state={{
                phase: 'judged',
                sql: live?.sql || q1.sql,
                ok: live?.ok ?? true,
                reason: live?.reason ?? '',
                gate: live ? live.gate : null,
                isLive: !!live,
              }}
            />
            <p className="dim" style={{ fontSize: 11, textAlign: 'center' }}>
              {live ? 'recorded verdict · validated' : 'recorded verdict · validated'}
            </p>
          </div>
        )}

        {tableFrame && (
          <div style={{ marginTop: 16 }}>
            <ResultView columns={q1.columns} rows={q1.rows} />
          </div>
        )}
        {barFrame && <p className="dim" style={{ fontSize: 12, textAlign: 'center' }}>Only what survives the gauntlet runs.</p>}
      </div>
    </div>
  )
}

function renderLinked(question: string, links: { phrase: string; kind: 'derived' | 'annotation' }[]) {
  const byWord = new Map(links.map((l) => [l.phrase.toLowerCase(), l.kind]))
  return question.split(/(\s+)/).map((tok, i) => {
    const bare = tok.replace(/[^A-Za-z0-9]/g, '')
    const kind = byWord.get(bare.toLowerCase())
    if (!kind) return tok
    return <span key={i} className={`hl ${kind}`}>{tok}</span>
  })
}
