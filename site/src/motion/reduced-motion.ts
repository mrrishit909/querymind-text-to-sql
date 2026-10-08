import { prefersReducedMotion } from './config'

/** Scales any motion-bible duration down to 0 under reduced motion, so a
 * single call site doesn't need an `if` for every animation. Content is
 * never removed -- only the travel between states is. */
export function dur(ms: number): number {
  return prefersReducedMotion() ? 0 : ms
}

export const STATIC_FRAME_CROSSFADE_MS = 120
export const STATIC_FRAME_HOLD_MS = 1200
