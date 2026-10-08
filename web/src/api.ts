/** Shared API types + clients for the /ask endpoints.
 *
 * Two code paths hit the same backend contract:
 *  - askOnce(): plain POST /api/ask (today's endpoint, always present).
 *  - streamAsk(): POST /api/ask/stream, parsed as a hand-rolled SSE reader
 *    (native EventSource can't POST a body, so this uses fetch + ReadableStream).
 *
 * The streaming endpoint is being built concurrently by another subagent
 * (sql-security-engineer) on the backend. Documented shape this client targets:
 *   event: generating_sql\ndata: {}\n\n
 *   event: validating\ndata: {}\n\n
 *   event: executing\ndata: {}\n\n
 *   event: answer\ndata: <AskResponse JSON, same shape as POST /ask>\n\n
 * If the endpoint 404s, errors, or the stream never emits an `answer` event,
 * streamAsk() throws and the caller falls back to askOnce().
 */

export interface AskResponse {
  question: string
  sql: string | null
  safety_status: 'validated' | 'rejected' | 'llm_declined'
  reason: string
  columns: string[]
  rows: Record<string, unknown>[]
  row_count: number
  answer: string
  cost_usd: number | null
  latency_s: number | null
}

export type AskStage = 'generating_sql' | 'validating' | 'executing' | 'answer'

export async function askOnce(question: string): Promise<AskResponse> {
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`${res.status}: ${JSON.stringify(body.detail ?? body)}`)
  }
  return res.json()
}

/** Parses one SSE frame ("event: x\ndata: y") into { event, data }. */
function parseFrame(frame: string): { event: string; data: string } {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  return { event, data: dataLines.join('\n') }
}

export async function streamAsk(
  question: string,
  onStage: (stage: AskStage) => void,
  signal?: AbortSignal,
): Promise<AskResponse> {
  const res = await fetch('/api/ask/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question }),
    signal,
  })
  if (!res.ok || !res.body) {
    throw new Error(`stream unavailable: ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    let sep: number
    while ((sep = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, sep)
      buf = buf.slice(sep + 2)
      if (!frame.trim()) continue
      const { event, data } = parseFrame(frame)
      if (event === 'answer') {
        return JSON.parse(data) as AskResponse
      }
      if (event === 'generating_sql' || event === 'validating' || event === 'executing') {
        onStage(event)
      }
    }
  }

  throw new Error('stream ended without an answer event')
}
