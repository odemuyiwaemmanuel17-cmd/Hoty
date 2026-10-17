import { Suspense, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { SCENE_ORIGINS } from '../../core/scene/sceneRegistry'
import { sceneActivity } from '../../core/scene/sceneDirector'
import { scrollSignal } from '../../core/stores/useSceneStore'
import { useSceneAsset } from '../../core/hooks/useHeroAsset'
import { CINEMATIC, fitAsset } from '../../assets/cinematic/assetManifest'
import { flameTexture } from '../../core/three/proceduralTextures'
import { Embers } from './Embers'
import { Smoke } from './Smoke'

/**
 * Scene 2 — Rotisserie grill.
 * The procedural stand-in is retired: this scene now presents the owner's
 * uploaded rotisserie photography as a layered cinematic plate — heat glow,
 * flame sprites, embers and smoke around a sharp, undistorted photograph.
 * A production GLB at /models/grill.glb still upgrades the scene if supplied.
 */

function PhotoRotisserie({ animating }: { animating: boolean }) {
  const tex = useLoader(THREE.TextureLoader, CINEMATIC.grill.url)
  tex.colorSpace = THREE.SRGBColorSpace
  const group = useRef<THREE.Group>(null)
  const glow = useRef<THREE.PointLight>(null)
  const size = useMemo(() => fitAsset(CINEMATIC.grill, 2.75, 3.1), [])

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime
    // parallax sway only — a photograph is never spun or deformed
    const target = Math.sin(t * 0.3) * 0.04
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, target, animating ? 0.05 : 1)
    if (glow.current) {
      const reveal = sceneActivity(scrollSignal.progress).grill
      glow.current.intensity = reveal * (5.5 + Math.sin(t * 7.3) * 1.2 + Math.sin(t * 17) * 0.6)
    }
    void dt
  })

  return (
    <group ref={group} position={[0, 1.15, 0]}>
      <mesh>
        <planeGeometry args={[size.w, size.h]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
      {/* warm heat wash from the photo's own coal panels */}
      <pointLight ref={glow} position={[0.4, -0.4, 1.1]} color="#ff6b18" distance={7} decay={2} />
    </group>
  )
}

function ProductionGrillModel({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  const prepared = useMemo(() => {
    const clone = scene.clone(true)
    const box = new THREE.Box3().setFromObject(clone)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const s = 3.0 / Math.max(size.y, 0.001)
    clone.scale.setScalar(s)
    clone.position.set(-center.x * s, -box.min.y * s, -center.z * s)
    return clone
  }, [scene])
  return <primitive object={prepared} />
}

function Flames({ count = 5 }: { count?: number }) {
  const refs = useRef<(THREE.Sprite | null)[]>([])
  const tex = useMemo(flameTexture, [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    refs.current.forEach((s, i) => {
      if (!s) return
      const f = 0.7 + Math.sin(t * (7 + i) + i * 2.1) * 0.18 + Math.sin(t * 23 + i) * 0.06
      s.scale.set(0.16 * f, 0.34 * f, 1)
      ;(s.material as THREE.SpriteMaterial).opacity = 0.5 + Math.sin(t * 9 + i * 1.7) * 0.22
    })
  })
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const x = -0.9 + (i / (count - 1)) * 1.8
        return (
          <sprite key={i} ref={(s) => (refs.current[i] = s)} position={[x, -0.15, 0.75]}>
            <spriteMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        )
      })}
    </>
  )
}

export function GrillScene({ animating, emberCount }: { animating: boolean; emberCount: number }) {
  const group = useRef<THREE.Group>(null)
  const keyLight = useRef<THREE.PointLight>(null)
  const fillLight = useRef<THREE.PointLight>(null)
  const hasProduction = useSceneAsset('/models/grill.glb')

  useFrame(() => {
    const g = group.current
    if (!g) return
    const reveal = sceneActivity(scrollSignal.progress).grill
    const on = reveal > 0.01
    if (g.visible !== on) g.visible = on
    if (!on) return
    if (keyLight.current) keyLight.current.intensity = 4 + reveal * 14
    if (fillLight.current) fillLight.current.intensity = reveal * 7
    g.scale.setScalar(0.96 + reveal * 0.04)
  })

  return (
    <group ref={group} position={[SCENE_ORIGINS.grill.x, 0, SCENE_ORIGINS.grill.z]} visible={false}>
      <pointLight ref={keyLight} position={[0, 1.3, 1.9]} color="#ff6b18" distance={11} decay={2} />
      <pointLight ref={fillLight} position={[0, 2.7, -0.4]} color="#ffb46b" distance={9} decay={2} />
      {hasProduction ? (
        <Suspense fallback={null}>
          <ProductionGrillModel url="/models/grill.glb" />
        </Suspense>
      ) : (
        <Suspense fallback={null}>
          <PhotoRotisserie animating={animating} />
        </Suspense>
      )}
      {animating && <Flames />}
      {animating && emberCount > 0 && (
        <group position={[0, 0.4, 0.4]} scale={0.32}>
          <Embers count={Math.min(emberCount, 140)} />
        </group>
      )}
      {animating && <Smoke count={6} position={[0, 2.6, 0.2]} scale={0.7} />}
    </group>
  )
}
