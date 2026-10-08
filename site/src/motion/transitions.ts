import { animate } from './timelines'
import { easeInOut } from './easings'

/** Upper/lower deck cross-dissolve between scroll beats (motion-bible.md:
 * "320ms ease.inOut, 24px vertical offset"). */
export function deckTransition(el: Element, direction: 'in' | 'out' = 'in') {
  const from = direction === 'in' ? [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'translateY(0)' }] : [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-24px)' }]
  return animate(el, from, { duration: 320, easing: easeInOut, fill: 'both' })
}
