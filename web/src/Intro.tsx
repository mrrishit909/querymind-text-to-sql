import { useEffect, useRef } from 'react'

/** Opening motion: a question fragments into SQL clause tokens that drift
 * into place as a query, then fade into the chat UI. Respects
 * prefers-reduced-motion and offers a skip control. */
export default function Intro({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (reduced) {
      onDone()
      return
    }
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const w = (canvas.width = window.innerWidth)
    const h = (canvas.height = window.innerHeight)

    const question = 'how many customers signed up in each city?'
    const clauses = ['SELECT', 'city,', 'COUNT(*)', 'FROM', 'v_customers', 'GROUP BY', 'city']

    const qChars = question.split('').map((ch, i) => ({
      ch,
      x: w / 2 - (question.length * 9) / 2 + i * 9,
      y: h * 0.42,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
    }))

    const tokens = clauses.map((t, i) => ({
      text: t,
      tx: w / 2 - 220 + (i % 3) * 150,
      ty: h * 0.58 + Math.floor(i / 3) * 34,
      x: Math.random() * w,
      y: Math.random() * h,
    }))

    let start: number | null = null
    const DURATION = 2400
    let raf = 0

    function frame(t: number) {
      if (start === null) start = t
      const elapsed = t - start!
      const prog = Math.min(1, elapsed / DURATION)

      ctx.fillStyle = '#0D1015'
      ctx.fillRect(0, 0, w, h)

      // phase 1 (0-0.4): question scatters
      const scatterProg = Math.min(1, prog / 0.4)
      ctx.font = '16px ui-monospace, monospace'
      ctx.fillStyle = '#DCE1E6'
      for (const c of qChars) {
        const x = c.x + c.vx * scatterProg * 40
        const y = c.y + c.vy * scatterProg * 40
        ctx.globalAlpha = 1 - scatterProg * 0.8
        ctx.fillText(c.ch, x, y)
      }
      ctx.globalAlpha = 1

      // phase 2 (0.3-1): tokens converge into query layout
      const tokenProg = Math.max(0, Math.min(1, (prog - 0.3) / 0.7))
      const ease = 1 - Math.pow(1 - tokenProg, 3)
      ctx.font = 'bold 15px ui-monospace, monospace'
      for (const tok of tokens) {
        const x = tok.x + (tok.tx - tok.x) * ease
        const y = tok.y + (tok.ty - tok.y) * ease
        ctx.fillStyle = ['SELECT', 'FROM', 'GROUP BY'].includes(tok.text) ? '#416CFF' : '#C1F46D'
        ctx.globalAlpha = Math.max(0.15, ease)
        ctx.fillText(tok.text, x, y)
      }
      ctx.globalAlpha = 1

      if (prog < 1) {
        raf = requestAnimationFrame(frame)
      } else {
        setTimeout(onDone, 350)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [onDone, reduced])

  if (reduced) return null

  return (
    <div className="fixed inset-0 bg-[#0D1015] z-50">
      <canvas ref={canvasRef} className="w-full h-full" />
      <button
        onClick={onDone}
        className="absolute bottom-6 right-6 text-sm text-[#DCE1E6]/60 hover:text-[#C1F46D] underline"
      >
        skip intro
      </button>
    </div>
  )
}
