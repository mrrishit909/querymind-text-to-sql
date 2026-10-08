// Tokens from design/approved/motion-bible.md, verbatim. Nothing here
// animates unless a query changed state -- see easings.ts / timelines.ts.
export const durGate = 60 // ms per gate, slug travel
export const durFlare = 200 // ms, gate hold flare
export const durWidth = 420 // ms, Martian Mono wdth transition
export const durCrossfade = 160 // ms, serif -> mono swap
export const durRowStagger = 50 // ms between rows
export const durRow = 240 // ms per row landing
export const durMorph = 520 // ms table <-> bar <-> line
export const durPulse = 600 // ms LIVE dot pulse

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
