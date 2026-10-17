import type { QualityTier } from '../stores/useSceneStore'

export interface TierConfig {
  dpr: [number, number]
  emberCount: number
  smokeSprites: number
  shadows: boolean
  envResolution: number
  bobMotion: boolean
}

export const TIER_CONFIG: Record<QualityTier, TierConfig> = {
  low: { dpr: [0.75, 1], emberCount: 90, smokeSprites: 0, shadows: false, envResolution: 64, bobMotion: false },
  medium: { dpr: [1, 1.5], emberCount: 220, smokeSprites: 8, shadows: false, envResolution: 128, bobMotion: true },
  high: { dpr: [1, 2], emberCount: 480, smokeSprites: 16, shadows: true, envResolution: 256, bobMotion: true },
}

/** Heuristic first guess before runtime FPS measurement takes over. */
export function detectInitialTier(): QualityTier {
  const cores = navigator.hardwareConcurrency ?? 4
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  if (mobile) return cores >= 6 && mem >= 6 ? 'medium' : 'low'
  return cores >= 8 ? 'high' : 'medium'
}
