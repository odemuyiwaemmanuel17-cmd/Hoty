import { Suspense, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { SCENE_ORIGINS } from '../../core/scene/sceneRegistry'
import { sceneActivity } from '../../core/scene/sceneDirector'
import { scrollSignal } from '../../core/stores/useSceneStore'
import { CINEMATIC, fitAsset, type CinematicAsset } from '../../assets/cinematic/assetManifest'
import { flameTexture } from '../../core/three/proceduralTextures'
import { Embers } from './Embers'

/**
 * Scene 4 — cinematic assembly.
 * Between the ingredient breakdown and the collection, the wrap "comes
 * together": the uploaded assembly reference (ingredients flying into the
 * cone) is the hero plate, with the fire-wrapped reference angled behind it
 * for depth. Scroll-driven reveal, gentle float, warm rim light — no fake
 * physical deformation of the photographs.
 */

function Plate({ asset, position, rotation, maxW, maxH, opacity }: {
  asset: CinematicAsset
  position: [number, number, number]
  rotation?: [number, number, number]
  maxW: number
  maxH: number
  opacity: number
}) {
  const tex = useLoader(THREE.TextureLoader, asset.url)
  tex.colorSpace = THREE.SRGBColorSpace
  const size = useMemo(() => fitAsset(asset, maxW, maxH), [asset, maxW, maxH])
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[size.w, size.h]} />
      <meshBasicMaterial map={tex} transparent opacity={opacity} toneMapped={false} />
    </mesh>
  )
}

export function AssemblyScene() {
  const group = useRef<THREE.Group>(null)
  const keyLight = useRef<THREE.PointLight>(null)
  const glow = useMemo(flameTexture, [])
  const [labelOn, setLabelOn] = useState(false)

  useFrame((state) => {
    const g = group.current
    if (!g) return
    const a = sceneActivity(scrollSignal.progress).assembly
    const on = a > 0.01
    if (g.visible !== on) g.visible = on
    if (labelOn !== a > 0.5) setLabelOn(a > 0.5)
    if (!on) return
    const t = state.clock.elapsedTime
    g.position.y = (1 - a) * -0.9 + Math.sin(t * 0.5) * 0.03
    g.scale.setScalar(0.94 + a * 0.06)
    if (keyLight.current) keyLight.current.intensity = a * (7 + Math.sin(t * 6.1) * 1.1)
  })

  return (
    <group ref={group} position={[SCENE_ORIGINS.assembly.x, 0, SCENE_ORIGINS.assembly.z]} visible={false}>
      <pointLight ref={keyLight} position={[0, 1.4, 1.8]} color="#ff8a3d" distance={8} decay={2} />
      <Suspense fallback={null}>
        {/* depth card behind, tilted like a set piece */}
        <Plate asset={CINEMATIC.fireWrap} position={[1.55, 1.15, -1.1]} rotation={[0, -0.42, 0.04]} maxW={1.7} maxH={2.1} opacity={0.85} />
        {/* assembly hero plate */}
        <Plate asset={CINEMATIC.assembly} position={[-0.25, 0.95, 0]} maxW={2.5} maxH={2.2} opacity={1} />
      </Suspense>
      {/* warm floor haze */}
      <sprite position={[0, 0.1, 0.4]} scale={[5.5, 3, 1]}>
        <spriteMaterial map={glow} transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <Embers count={60} />
      {labelOn && (
        <Html position={[-1.55, 0.18, 0.3]} center distanceFactor={8} zIndexRange={[20, 0]}>
          <div className="pointer-events-none w-56 select-none text-center">
            <p className="font-[family-name:var(--font-display)] text-xl text-cream" style={{ textShadow: '0 2px 10px #000' }}>
              Assembled to order
            </p>
            <p className="text-[10px] uppercase tracking-[0.35em] text-ember">wrapped over open fire</p>
          </div>
        </Html>
      )}
    </group>
  )
}
