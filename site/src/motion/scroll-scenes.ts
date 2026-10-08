/** Scroll drives which beat is active; it never scrubs an animation frame
 * by frame (motion-bible.md). Fires `onEnter(id)` once per beat crossing
 * 40% visibility, per scroll-storyboard.md. */
export function observeBeats(ids: string[], onEnter: (id: string) => void): () => void {
  const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e)
  if (!els.length || typeof IntersectionObserver === 'undefined') return () => {}
  const obs = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) onEnter(e.target.id)
      }
    },
    { threshold: 0.4 },
  )
  for (const el of els) obs.observe(el)
  return () => obs.disconnect()
}
