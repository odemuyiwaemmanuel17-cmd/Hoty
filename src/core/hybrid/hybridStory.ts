/**
 * Hybrid cinematic story — pure scroll→media mapping.
 *
 * VIDEO ONE (welcome): the original shawarma film plays normally as the
 * landing hero — muted, inline, autoplay, never scroll-scrubbed.
 * VIDEO TWO (experience): the newly supplied shawarma film (grill → slicing →
 * ingredients → rolling → sauce → finished wrap) is dissected into 300
 * sequential JPG frames (public/frames/shawarma2/). The ONE master scroll
 * timeline (scrollSignal) crossfades from the welcome video into a canvas
 * scrubbing those frames: scroll advances, reverse rewinds, and the sequence
 * HOLDS on the finished meal (frame 240) as the menu takes over. The film's
 * tail (fries boxes, packaging shots, frames 250-300) is intentionally unused
 * so the last thing before the menu is an appetizing finished shawarma.
 *
 * Everything here is a pure function of master progress (0..1) so it can be
 * unit-tested and read inside one requestAnimationFrame loop without React
 * state churn.
 */

export const FRAME_COUNT = 300
export const VIDEO_URL = '/media/shawarma-intro.mp4'
export const POSTER_URL = '/media/shawarma-poster.jpg'
/** Canvas-layer fallback poster — a beat from the SAME film the scrub shows. */
export const STAGE_POSTER_URL = '/media/shawarma2-meal.jpg'

/** 0-based frame index → zero-padded JPG url (frames are numbered 001..300). */
export function frameUrl(index: number): string {
  const i = Math.min(FRAME_COUNT - 1, Math.max(0, Math.round(index)))
  return `/frames/shawarma2/ezgif-frame-${String(i + 1).padStart(3, '0')}.jpg`
}

/** Phase boundaries across the master scroll region (normalized 0..1). */
export const INTRO_END = 0.1 // video plays solo until here
export const CROSSFADE_END = 0.16 // video → frame-canvas crossfade completes here

/**
 * The scrub stops at the finished plated meal (frame 240, 0-based index 239)
 * and holds it — the film's tail (fries-box and packaging shots, indices
 * 240-269+) is intentionally unused so the last thing before the menu is an
 * appetizing finished shawarma.
 */
export const SCRUB_LAST_FRAME = 239
/**
 * Progress at which the finished meal is fully revealed, then held. The menu
 * section begins sliding up over the stage at p = 500/600 ≈ 0.833 (viewport
 * independent, since the whole region is sized in svh), so the meal is
 * revealed and the handoff CTA shown cleanly before that.
 */
export const SCRUB_REACH = 0.72

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** 0→1 ramp of `p` across [from,to]. */
function ramp(p: number, from: number, to: number): number {
  if (to <= from) return p >= to ? 1 : 0
  return clamp01((p - from) / (to - from))
}

/** Opening video layer opacity: full during intro, fades out across crossfade. */
export function videoOpacity(p: number): number {
  return 1 - ramp(p, INTRO_END, CROSSFADE_END)
}

/** Frame canvas layer opacity: hidden during intro, fades in across crossfade. */
export function canvasOpacity(p: number): number {
  return ramp(p, INTRO_END, CROSSFADE_END)
}

/** Title / CTA overlay opacity: visible over the intro, fades as scrub begins. */
export function overlayOpacity(p: number): number {
  return 1 - ramp(p, INTRO_END, CROSSFADE_END)
}

/**
 * Frame index for the scrub. Stays on frame 0 (the rotisserie grills — the
 * new film's opening shot) through the crossfade, then advances 0..239
 * (grill → slicing → ingredients → rolling → sauce → finished wrap) across
 * the master scroll, reaching the meal at SCRUB_REACH and holding it until
 * the menu slides in. Reversible: lower progress → lower index.
 */
export function frameIndexFromProgress(p: number): number {
  const t = ramp(p, CROSSFADE_END, SCRUB_REACH)
  return Math.round(t * SCRUB_LAST_FRAME)
}

/**
 * Menu-handoff CTA: fades in while the finished plated meal is held on
 * screen, then releases to zero just as the menu section takes over the
 * viewport (so it never floats over menu content).
 */
export function handoffOpacity(p: number): number {
  return ramp(p, 0.75, 0.82) * (1 - ramp(p, 0.87, 0.93))
}
