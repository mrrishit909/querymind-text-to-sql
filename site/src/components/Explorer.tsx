import type { Question } from '../data/fixtures'

export function Explorer({
  questions,
  selected,
  liveMatched,
  onSelect,
}: {
  questions: Question[]
  selected: Question
  liveMatched: Set<string>
  onSelect: (q: Question) => void
}) {
  const categories = Array.from(new Set(questions.map((q) => q.category)))

  return (
    <div className="explorer-grid" aria-label="twelve real questions, by category">
      {categories.map((cat) => (
        <div className="explorer-cat" key={cat}>
          <h3>{cat}</h3>
          {questions
            .filter((q) => q.category === cat)
            .map((q) => (
              <button
                key={q.question}
                type="button"
                className="explorer-q"
                aria-current={q === selected}
                onClick={() => onSelect(q)}
              >
                {q.question}
                <span className={`tag ${q.safety_status === 'validated' ? 'validated' : 'declined'}`}>
                  {q.safety_status === 'validated' ? 'validated' : 'declined by Claude'}
                </span>
                {liveMatched.has(q.question) && <span className="tag live">LIVE</span>}
              </button>
            ))}
        </div>
      ))}
    </div>
  )
}
