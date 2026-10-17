import * as THREE from 'three'

/**
 * Centralized SceneDirector state mapping: pure functions of master scroll
 * progress → per-scene activity. Every scene component and the UI read from
 * here so visibility, animation and interaction availability stay in lockstep
 * and reverse scrolling is automatically correct.
 */

export interface SceneActivity {
  hero: number // 0..1 presence (sinks away as the grill takes over)
  grill: number // 0..1 reveal (lights ramp, flames grow)
  ingredients: number // 0..1 presence
  explode: number // 0..1 ingredient separation amount
  assembly: number // 0..1 cinematic assembly scene presence
  collection: number // 0..1 product collection presence
  /** Scroll ranges where each scene owns interaction. */
  heroActive: boolean
  grillActive: boolean
  ingredientsActive: boolean
  assemblyActive: boolean
  collectionActive: boolean
}

const ramp = (p: number, from: number, to: number) =>
  THREE.MathUtils.smoothstep(p, from, to)

export function sceneActivity(progress: number): SceneActivity {
  const p = Math.min(1, Math.max(0, progress))
  return {
    hero: 1 - ramp(p, 0.13, 0.24),
    grill: Math.min(ramp(p, 0.18, 0.3), 1 - ramp(p, 0.48, 0.56)),
    ingredients: Math.min(ramp(p, 0.5, 0.6), 1 - ramp(p, 0.71, 0.76)),
    explode: ramp(p, 0.6, 0.7),
    assembly: Math.min(ramp(p, 0.72, 0.77), 1 - ramp(p, 0.80, 0.84)),
    collection: ramp(p, 0.79, 0.85),
    heroActive: p < 0.2,
    grillActive: p >= 0.2 && p < 0.48,
    ingredientsActive: p >= 0.48 && p < 0.72,
    assemblyActive: p >= 0.72 && p < 0.8,
    collectionActive: p >= 0.8,
  }
}

export type CinematicScene = 'hero' | 'grill' | 'ingredients' | 'assembly' | 'collection' | 'menu'

export function currentScene(progress: number): CinematicScene {
  if (progress >= 0.995) return 'menu'
  const a = sceneActivity(progress)
  if (a.collectionActive) return 'collection'
  if (a.assemblyActive) return 'assembly'
  if (a.ingredientsActive) return 'ingredients'
  if (a.grillActive) return 'grill'
  return 'hero'
}
