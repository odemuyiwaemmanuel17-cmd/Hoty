import { describe, it, expect } from 'vitest'
import {
  FRAME_COUNT,
  SCRUB_LAST_FRAME,
  SCRUB_REACH,
  frameUrl,
  frameIndexFromProgress,
  videoOpacity,
  canvasOpacity,
  overlayOpacity,
  handoffOpacity,
  clamp01,
  INTRO_END,
  CROSSFADE_END,
} from '../src/core/hybrid/hybridStory'

describe('hybrid frame mapping', () => {
  it('builds zero-padded sequential frame urls for the scrub film (001..300)', () => {
    expect(frameUrl(0)).toBe('/frames/shawarma2/ezgif-frame-001.jpg')
    expect(frameUrl(9)).toBe('/frames/shawarma2/ezgif-frame-010.jpg')
    expect(frameUrl(FRAME_COUNT - 1)).toBe('/frames/shawarma2/ezgif-frame-300.jpg')
  })

  it('clamps out-of-range indices', () => {
    expect(frameUrl(-5)).toBe('/frames/shawarma2/ezgif-frame-001.jpg')
    expect(frameUrl(9999)).toBe('/frames/shawarma2/ezgif-frame-300.jpg')
  })

  it('holds frame 0 through the crossfade, then advances to the plated meal and holds', () => {
    expect(frameIndexFromProgress(0)).toBe(0)
    expect(frameIndexFromProgress(INTRO_END)).toBe(0)
    expect(frameIndexFromProgress(CROSSFADE_END)).toBe(0)
    // ends on the finished wrap (frame 240), never the fries-box tail
    expect(SCRUB_LAST_FRAME).toBe(239)
    expect(SCRUB_LAST_FRAME).toBeLessThan(FRAME_COUNT - 1)
    expect(frameIndexFromProgress(SCRUB_REACH)).toBe(SCRUB_LAST_FRAME)
    expect(frameIndexFromProgress(1)).toBe(SCRUB_LAST_FRAME)
    let prev = -1
    for (let p = CROSSFADE_END; p <= 1.0001; p += 0.01) {
      const i = frameIndexFromProgress(p)
      expect(i).toBeGreaterThanOrEqual(prev)
      prev = i
    }
  })

  it('is reversible (lower progress never yields a higher frame)', () => {
    expect(frameIndexFromProgress(0.8)).toBeGreaterThan(frameIndexFromProgress(0.7))
    expect(frameIndexFromProgress(0.5)).toBeGreaterThan(frameIndexFromProgress(0.3))
    expect(frameIndexFromProgress(0.3)).toBeLessThan(frameIndexFromProgress(0.85))
  })

  it('crossfades video out as canvas fades in', () => {
    expect(videoOpacity(0)).toBe(1)
    expect(canvasOpacity(0)).toBe(0)
    expect(videoOpacity(CROSSFADE_END)).toBeCloseTo(0)
    expect(canvasOpacity(CROSSFADE_END)).toBeCloseTo(1)
    // complementary across the whole crossfade window
    for (let p = INTRO_END; p <= CROSSFADE_END; p += 0.01) {
      expect(videoOpacity(p) + canvasOpacity(p)).toBeCloseTo(1, 6)
    }
  })

  it('fades the opening overlay out as the scrub takes over', () => {
    expect(overlayOpacity(0)).toBe(1)
    expect(overlayOpacity(CROSSFADE_END)).toBeCloseTo(0)
  })

  it('shows the menu handoff over the clean plated meal, then releases before the menu covers', () => {
    // menu begins sliding in at p≈0.833; handoff must be gone by then
    expect(handoffOpacity(0.5)).toBe(0)
    expect(handoffOpacity(0.75)).toBe(0)
    expect(handoffOpacity(0.83)).toBe(1) // meal held clean, CTA fully live
    expect(handoffOpacity(0.93)).toBe(0) // faded as the menu takes the viewport
    expect(handoffOpacity(0.8)).toBeGreaterThan(handoffOpacity(0.77))
  })

  it('clamp01 bounds', () => {
    expect(clamp01(-1)).toBe(0)
    expect(clamp01(2)).toBe(1)
    expect(clamp01(0.4)).toBe(0.4)
  })
})
