import { useEffect, useState } from 'react'
import { probeAsset } from './assetProbe'
import { CINEMATIC } from '../../assets/cinematic/assetManifest'

export type HeroAssetMode = 'probing' | 'model' | 'photo' | 'stage'

/**
 * Asset pipeline resolver for the hero subject.
 * Priority: photorealistic GLB > owner photography (image plane) > abstract ember stage.
 * Never substitutes fake food.
 */
export function useHeroAsset(): HeroAssetMode {
  const [mode, setMode] = useState<HeroAssetMode>('probing')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const hasModel = await probeAsset('/models/shawarma.glb', 'model')
      if (cancelled) return
      if (hasModel) return setMode('model')
      const hasPhoto = await probeAsset(CINEMATIC.hero.url, 'image')
      if (cancelled) return
      setMode(hasPhoto ? 'photo' : 'stage')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return mode
}

/**
 * Generic scene-asset probe (same rules as the hero): a real GLB at the given
 * path upgrades the scene from its labelled temporary procedural stand-in.
 */
export function useSceneAsset(url: string): boolean {
  const [present, setPresent] = useState(false)
  useEffect(() => {
    let cancelled = false
    probeAsset(url, 'model').then((ok) => !cancelled && setPresent(ok))
    return () => {
      cancelled = true
    }
  }, [url])
  return present
}
