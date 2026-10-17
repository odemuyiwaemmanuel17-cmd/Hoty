import { describe, expect, it } from 'vitest'
import { resolveCamera, SCENE_ORIGINS } from '../src/core/scene/sceneRegistry'
import { currentScene, sceneActivity } from '../src/core/scene/sceneDirector'

describe('scene director determinism (reverse-scroll behaviour)', () => {
  it('is a pure function of progress: same input → same output', () => {
    for (const p of [0, 0.13, 0.35, 0.62, 0.88, 1]) {
      const a = resolveCamera(p, 1.6)
      const b = resolveCamera(p, 1.6)
      expect(a.position.toArray()).toEqual(b.position.toArray())
      expect(a.fov).toBe(b.fov)
    }
  })

  it('forward then reverse returns to identical poses', () => {
    const forward: number[] = []
    for (let i = 0; i <= 10; i++) forward.push(sceneActivity(i / 10).explode)
    const reverse: number[] = []
    for (let i = 10; i >= 0; i--) reverse.unshift(sceneActivity(i / 10).explode)
    expect(forward).toEqual(reverse)
  })

  it('explode factor is monotonic 0→1 across its range', () => {
    expect(sceneActivity(0.6).explode).toBe(0)
    expect(sceneActivity(0.65).explode).toBeGreaterThan(0)
    expect(sceneActivity(0.65).explode).toBeLessThan(1)
    expect(sceneActivity(0.7).explode).toBe(1)
    expect(sceneActivity(0.85).explode).toBe(1)
  })

  it('assembly scene occupies its own scroll band', () => {
    expect(sceneActivity(0.7).assembly).toBe(0)
    expect(sceneActivity(0.77).assembly).toBeGreaterThan(0.5)
    expect(currentScene(0.78)).toBe('assembly')
    expect(currentScene(0.75)).toBe('assembly')
    expect(sceneActivity(0.9).assembly).toBe(0)
  })

  it('covers the whole timeline with exactly one dominant scene', () => {
    expect(currentScene(0)).toBe('hero')
    expect(currentScene(0.3)).toBe('grill')
    expect(currentScene(0.6)).toBe('ingredients')
    expect(currentScene(0.9)).toBe('collection')
    expect(currentScene(1)).toBe('menu')
  })

  it('mobile (narrow) framing dollies back relative to desktop', () => {
    const wide = resolveCamera(0.9, 1.8)
    const narrow = resolveCamera(0.9, 0.5)
    const dWide = wide.position.distanceTo(SCENE_ORIGINS.collection)
    const dNarrow = narrow.position.distanceTo(SCENE_ORIGINS.collection)
    expect(dNarrow).toBeGreaterThan(dWide)
  })

  it('camera path reaches every scene origin region', () => {
    const near = (p: number, target: { x: number; z: number }, max: number) => {
      const cam = resolveCamera(p, 1.6)
      return Math.hypot(cam.position.x - target.x, cam.position.z - target.z) < max
    }
    expect(near(0.05, SCENE_ORIGINS.hero, 8)).toBe(true)
    expect(near(0.36, SCENE_ORIGINS.grill, 8)).toBe(true)
    expect(near(0.66, SCENE_ORIGINS.ingredients, 8)).toBe(true)
    expect(near(0.8, SCENE_ORIGINS.assembly, 8)).toBe(true)
    expect(near(0.93, SCENE_ORIGINS.collection, 8)).toBe(true)
  })
})
