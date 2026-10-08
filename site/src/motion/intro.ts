// Timing table from design/approved/scroll-storyboard.md "Intro". The
// Intro component drives the actual DOM/WAAPI; this module holds the
// numbers and the deterministic phrase-matcher so Inspector highlighting
// (scroll-storyboard.md: "the same rule powers the Inspector's
// question-to-SQL highlighting") can reuse exactly the same function.
export const INTRO_TOTAL_MS = 10200

export const INTRO_FRAMES = [
  { t: 0, label: 'question types in' },
  { t: 1400, label: 'phrases underline' },
  { t: 2600, label: 'words separate into groups' },
  { t: 3800, label: 'groups become clauses' },
  { t: 5200, label: 'slug travels the gates' },
  { t: 6400, label: 'table assembles' },
  { t: 7600, label: 'table becomes bars' },
  { t: 8800, label: 'bars dock, hero resolves' },
  { t: INTRO_TOTAL_MS, label: 'done' },
] as const

export interface PhraseLink {
  phrase: string
  target: string
  kind: 'derived' | 'annotation'
}

function stem(word: string): string {
  const w = word.toLowerCase()
  if (w.endsWith('ies')) return `${w.slice(0, -3)}y`
  if (w.endsWith('s') && w.length > 3) return w.slice(0, -1)
  return w
}

/** Deterministic phrase -> SQL-clause matcher. No stored alignment data:
 * everything derivable is found by matching question tokens against the
 * regenerated SQL's identifiers, aliases and literals. Anything left over
 * is an annotation (editorial, not string-derivable) -- scroll-storyboard.md
 * "Matching rule". */
export function matchPhrases(question: string, sql: string, approvedViews: string[]): PhraseLink[] {
  const links: PhraseLink[] = []
  const words = question.match(/[A-Za-z0-9]+/g) ?? []
  const sqlLower = sql.toLowerCase()
  const viewStems = approvedViews.map((v) => v.replace(/^v_/, ''))

  for (const word of words) {
    if (word.length <= 2) continue
    const s = stem(word)
    if (/^\d+$/.test(word) && sqlLower.includes(`limit ${word}`)) {
      links.push({ phrase: word, target: `LIMIT ${word}`, kind: 'derived' })
      continue
    }
    if (viewStems.some((v) => v.includes(s) || s.includes(v))) {
      links.push({ phrase: word, target: `v_${viewStems.find((v) => v.includes(s) || s.includes(v))}`, kind: 'derived' })
      continue
    }
    if (sqlLower.includes(`'${s}'`) || sqlLower.includes(s)) {
      links.push({ phrase: word, target: word, kind: 'derived' })
    }
  }
  if (/\bmost\b|\bleast\b|\btop\b/i.test(question)) {
    links.push({ phrase: 'most', target: 'ORDER BY ... DESC', kind: 'annotation' })
  }
  return links
}
