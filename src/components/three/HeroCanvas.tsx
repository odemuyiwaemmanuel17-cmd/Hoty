import { Suspense, useEffect, useMemo } from 'react'
import { Canvas, invalidate } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { CameraDirector } from './CameraDirector'
import { LightingRig } from './LightingRig'
import { HeroSubject } from './HeroSubject'
import { Embers } from './Embers'
import { Smoke } from './Smoke'
import { GrillScene } from './GrillScene'
import { IngredientsScene } from './IngredientsScene'
import { AssemblyScene } from './AssemblyScene'
import { FoodCollectionScene } from './FoodCollectionScene'
import { ProgressGate } from './ProgressGate'
import { detectInitialTier, TIER_CONFIG } from '../../core/quality/tiers'
import { useSceneStore, type QualityTier } from '../../core/stores/useSceneStore'
import { useHeroAsset } from '../../core/hooks/useHeroAsset'

const ORDER: QualityTier[] = ['high', 'medium', 'low']

export default function HeroCanvas({
  reducedMotion,
  onReady,
}: {
  reducedMotion: boolean
  onReady?: () => void
}) {
  const heroVisible = useSceneStore((s) => s.heroVisible)
  const quality = useSceneStore((s) => s.quality)
  const autoQuality = useSceneStore((s) => s.autoQuality)
  const tier = TIER_CONFIG[quality]
  const assetMode = useHeroAsset()
  const subjectMode = assetMode === 'probing' ? 'stage' : assetMode

  // Heuristic starting tier before FPS-based adaptation takes over.
  useEffect(() => {
    if (autoQuality) useSceneStore.setState({ quality: reducedMotion ? 'low' : detectInitialTier() })
  }, [autoQuality, reducedMotion])

  // Repaint once when the loop is parked (demand rendering correctness).
  useEffect(() => {
    invalidate()
  }, [quality, subjectMode, reducedMotion])

  const downgrade = useMemo(
    () => () => {
      const current = useSceneStore.getState().quality
      const idx = ORDER.indexOf(current)
      if (idx >= 0 && idx < ORDER.length - 1 && useSceneStore.getState().autoQuality) {
        useSceneStore.setState({ quality: ORDER[idx + 1] })
      }
    },
    [],
  )

  const animating = !reducedMotion && heroVisible

  return (
    <Canvas
      dpr={tier.dpr}
      frameloop={animating ? 'always' : 'never'}
      camera={{ position: [0, 0.35, 5.2], fov: 42, near: 0.1, far: 60 }}
      gl={{
        antialias: quality !== 'low',
        powerPreference: 'high-performance',
        alpha: true,
      }}
      onCreated={({ gl, camera, scene }) => {
        gl.setClearColor(new THREE.Color('#0a0a0b'), 0)
        if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__haDbg = { camera, scene }
        onReady?.()
      }}
      style={{ position: 'absolute', inset: 0, touchAction: 'pan-y' }}
    >
      <fog attach="fog" args={['#0a0a0b', 7, 15]} />
      {animating && autoQuality && (
        <PerformanceMonitor iterations={35} flipflops={3} onDecline={downgrade} onFallback={downgrade} />
      )}
      <AdaptiveDpr />

      <CameraDirector active={!reducedMotion} />
      <LightingRig envResolution={tier.envResolution} />

      <Suspense fallback={null}>
        <HeroSubject mode={subjectMode} bob={tier.bobMotion && !reducedMotion} />
        {animating && (
          <ProgressGate from={0} to={0.22}>
            {tier.emberCount > 0 && <Embers count={tier.emberCount} />}
            {tier.smokeSprites > 0 && <Smoke count={tier.smokeSprites} />}
          </ProgressGate>
        )}
        <GrillScene animating={animating && !reducedMotion} emberCount={tier.emberCount} />
        <IngredientsScene />
        <AssemblyScene />
        <FoodCollectionScene />
      </Suspense>
    </Canvas>
  )
}
