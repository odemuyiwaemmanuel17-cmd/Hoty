import * as THREE from 'three'

export interface CameraPose {
  position: [number, number, number]
  lookAt: [number, number, number]
  fov: number
}

interface CameraKeyframe extends CameraPose {
  /** Master scroll progress (0..1) at which this pose is exact. */
  p: number
}

/**
 * World layout (a single corridor so one Canvas renders the whole journey):
 *   Scene 1 — floating shawarma    at (0, 0, 0)
 *   Scene 2 — rotisserie grill     at (0, 0, -12)
 *   Scene 3 — exploded ingredients at (0, 0, -24)
 *   Scene 5 — food collection      at (0, 0, -36)
 */
export const SCENE_ORIGINS = {
  hero: new THREE.Vector3(0, 0, 0),
  grill: new THREE.Vector3(0, 0, -12),
  ingredients: new THREE.Vector3(0, 0.9, -24),
  assembly: new THREE.Vector3(0, 0.55, -30),
  collection: new THREE.Vector3(0, 0, -36),
} as const

/**
 * Deterministic keyframe timeline. Forward and reverse scrolling sample the
 * same pure function — no state, no drift, no teleporting.
 */
const KEYS: CameraKeyframe[] = [
  // Scene 1 — floating shawarma: scroll pushes INTO the hero subject (reference-short zoom)
  { p: 0.0, position: [0, 0.35, 5.2], lookAt: [0, 0.15, 0], fov: 42 },
  { p: 0.12, position: [0.3, 0.45, 4.25], lookAt: [0, 0.25, 0], fov: 37 },
  // Transition — lift away from the hero, grill lights come up ahead
  { p: 0.22, position: [2.3, 1.7, 2.6], lookAt: [0, 1.3, -12], fov: 44 },
  // Scene 2 — rotisserie reveal → approach → meat close-up
  { p: 0.32, position: [0, 1.6, -6.4], lookAt: [0, 1.35, -12], fov: 40 },
  { p: 0.42, position: [1.05, 1.32, -9.5], lookAt: [0.25, 1.25, -12], fov: 34 },
  // Transition — pull out of the heat, ingredients await deeper in the room
  { p: 0.52, position: [3.1, 1.9, -16.2], lookAt: [0, 1.0, -24], fov: 44 },
  // Scene 3 — composed stack → exploded breakdown
  { p: 0.62, position: [0, 1.0, -19.4], lookAt: [0, 0.95, -24], fov: 40 },
  { p: 0.70, position: [0.6, 1.35, -19.0], lookAt: [0, 1.05, -24], fov: 41 },
  // Scene 4 — assembly: the wrap closes as ingredients fly in (photo plate)
  { p: 0.76, position: [1.4, 1.05, -25.0], lookAt: [0, 0.6, -30], fov: 40 },
  { p: 0.80, position: [0, 0.72, -27.6], lookAt: [0, 0.6, -30], fov: 37 },
  // Scene 5 — cinematic product collection (peaks before the menu section rises)
  { p: 0.85, position: [0, 1.35, -31.6], lookAt: [0, 1.05, -36], fov: 42 },
  { p: 0.90, position: [0, 1.45, -31.2], lookAt: [0, 1.15, -36], fov: 42 },
  // Release into the menu
  { p: 1.0, position: [0, 2.6, -30.2], lookAt: [0, 0.2, -36], fov: 50 },
]

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()

export interface ResolvedCamera {
  position: THREE.Vector3
  lookAt: THREE.Vector3
  fov: number
}

/** Which keyframe segment the progress currently lives in (for scene routing). */
export function segmentOf(progress: number): number {
  const p = Math.min(1, Math.max(0, progress))
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (p >= KEYS[i].p && p <= KEYS[i + 1].p) return i
  }
  return KEYS.length - 2
}

/**
 * Centralized SceneDirector camera solve: given master scroll progress and
 * viewport aspect, return the exact cinematic pose. Mobile-first: the corridor
 * dolley backs as the viewport narrows so subjects stay framed.
 */
export function resolveCamera(progress: number, aspect: number): ResolvedCamera {
  const p = Math.min(1, Math.max(0, progress))
  const i = segmentOf(p)
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const t = THREE.MathUtils.smoothstep((p - a.p) / (b.p - a.p), 0, 1)

  const position = _a.set(...a.position).lerp(_b.set(...b.position), t).clone()
  const lookAt = _a.set(...a.lookAt).lerp(_b.set(...b.lookAt), t).clone()
  const fov = THREE.MathUtils.lerp(a.fov, b.fov, t)

  const narrow = THREE.MathUtils.clamp(1.35 / Math.max(aspect, 0.45), 1, 1.65)
  position.sub(lookAt).multiplyScalar(narrow).add(lookAt)

  return { position, lookAt, fov }
}
