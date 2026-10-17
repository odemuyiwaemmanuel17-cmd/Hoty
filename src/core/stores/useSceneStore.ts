import { create } from 'zustand'

export type QualityTier = 'low' | 'medium' | 'high'

interface SceneState {
  /** Normalized scroll progress 0..1 across the hero scroll region. */
  progress: number
  /** Whether the hero canvas layer is on screen (gates the render loop). */
  heroVisible: boolean
  quality: QualityTier
  autoQuality: boolean
  dragAzimuth: number
  setProgress: (p: number) => void
  setHeroVisible: (v: boolean) => void
  setQuality: (q: QualityTier) => void
  setDragAzimuth: (rad: number) => void
}

export const useSceneStore = create<SceneState>((set) => ({
  progress: 0,
  heroVisible: true,
  quality: 'high',
  autoQuality: true,
  dragAzimuth: 0,
  setProgress: (p) => set({ progress: Math.min(1, Math.max(0, p)) }),
  setHeroVisible: (v) => set({ heroVisible: v }),
  setQuality: (q) => set({ quality: q, autoQuality: false }),
  setDragAzimuth: (rad) => set({ dragAzimuth: rad }),
}))

/** Mutable ref-style channel for high-frequency values (avoids React re-renders per frame). */
export const scrollSignal = { progress: 0 }
