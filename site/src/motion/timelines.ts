import { dur } from './reduced-motion'

/** Thin WAAPI wrapper. Every call routes duration through `dur()` so
 * reduced motion collapses it to an instant, visible end state, never a
 * skipped one. */
export function animate(el: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes, options: KeyframeAnimationOptions): Animation {
  return el.animate(keyframes, { ...options, duration: dur(Number(options.duration ?? 0)) })
}

/** FLIP: measure, let the caller mutate the DOM, then animate the visual
 * delta away. Used for table -> bar -> line and row reordering, so a given
 * row is always the same DOM node in every view (motion-bible.md, "a morph
 * always preserves object identity"). */
export function flip(el: HTMLElement, mutate: () => void, options: KeyframeAnimationOptions = { duration: 520, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' }) {
  const first = el.getBoundingClientRect()
  mutate()
  const last = el.getBoundingClientRect()
  const dx = first.left - last.left
  const dy = first.top - last.top
  const sx = first.width / Math.max(last.width, 1)
  const sy = first.height / Math.max(last.height, 1)
  if (dx === 0 && dy === 0 && sx === 1 && sy === 1) return
  animate(
    el,
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
      { transform: 'none' },
    ],
    options,
  )
}
