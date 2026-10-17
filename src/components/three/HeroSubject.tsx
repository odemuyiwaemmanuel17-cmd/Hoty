import { Component, Suspense, useMemo, useRef, type ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { useSceneStore } from '../../core/stores/useSceneStore'
import { CINEMATIC, fitAsset } from '../../assets/cinematic/assetManifest'

/* ─────────────────────────────────────────────────────────────────────────
 * Hero subject pipeline. Mode is resolved by useHeroAsset():
 *   'model'  → photorealistic shawarma GLB from /models/shawarma.glb
 *   'photo'  → owner photography as a lit 2.5D plate from the cinematic manifest hero
 *   'stage'  → honest abstract ember stage (NO fake food primitives)
 * ──────────────────────────────────────────────────────────────────────── */

const DRAG_EASE = 0.07

function useSpinState(bob: boolean) {
  const group = useRef<THREE.Group>(null)
  const autoAngle = useRef(0)

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    const { dragAzimuth } = useSceneStore.getState()
    autoAngle.current += dt * 0.14 // slow controlled rotation
    const target = autoAngle.current + dragAzimuth
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, target, DRAG_EASE)
    if (bob) g.position.y = Math.sin(state.clock.elapsedTime * 0.7) * 0.055
  })

  return group
}

/* ── Photoreal model ── */
function ShawarmaModel({ url, bob }: { url: string; bob: boolean }) {
  const { scene } = useGLTF(url)
  const group = useSpinState(bob)

  const prepared = useMemo(() => {
    const clone = scene.clone(true)
    const box = new THREE.Box3().setFromObject(clone)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const scale = 2.5 / Math.max(size.y, 0.001)
    clone.scale.setScalar(scale)
    clone.position.set(-center.x * scale, -center.y * scale + 0.25, -center.z * scale)
    clone.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && m.material) {
        const mat = m.material as THREE.MeshStandardMaterial
        if ('envMapIntensity' in mat) mat.envMapIntensity = 1.1
      }
    })
    return clone
  }, [scene])

  return (
    <group ref={group}>
      <primitive object={prepared} />
    </group>
  )
}

/* ── Owner-uploaded cinematic photography plate ──
   The hero reference is a full 16:9 cinematic frame, so it gets a floating
   2.5D treatment: gentle bob, micro perspective tilt, clamped drag parallax.
   A photograph is never spun or deformed. */
function PhotoPlate({ url, bob }: { url: string; bob: boolean }) {
  const tex = useLoader(THREE.TextureLoader, url)
  tex.colorSpace = THREE.SRGBColorSpace
  const group = useRef<THREE.Group>(null)
  const size = useMemo(() => fitAsset(CINEMATIC.hero, 3.9, 2.25), [])

  useFrame((state) => {
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime
    const { dragAzimuth } = useSceneStore.getState()
    const targetY = Math.sin(t * 0.4) * 0.05 + THREE.MathUtils.clamp(dragAzimuth, -0.22, 0.22)
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, targetY, 0.05)
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, Math.sin(t * 0.33) * 0.022, 0.05)
    g.position.y = bob ? Math.sin(t * 0.6) * 0.06 : 0
  })

  return (
    <group ref={group}>
      <mesh>
        <planeGeometry args={[size.w, size.h]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
      {/* fire glow bleeding from the frame's own embers */}
      <pointLight position={[0, 0.2, 1.4]} intensity={2.4} color="#ff8a3d" distance={6} decay={2} />
      <pointLight position={[0, -0.6, -0.8]} intensity={3.2} color="#ff5210" distance={5} decay={2} />
    </group>
  )
}

/* ── Abstract ember stage: honest placeholder while awaiting production assets ── */
export function EmberStage({ interactive = true }: { interactive?: boolean }) {
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const { dragAzimuth } = useSceneStore.getState()
    if (group.current && interactive) {
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        state.clock.elapsedTime * 0.1 + dragAzimuth,
        DRAG_EASE,
      )
    }
    if (ring.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 1.4) * 0.03
      ring.current.scale.set(s, s, s)
    }
  })

  return (
    <group ref={group} position={[0, 0.15, 0]}>
      {/* ember ring — lighting fixture, clearly not food */}
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.15, 0.018, 16, 120]} />
        <meshBasicMaterial color="#ff6b18" toneMapped={false} transparent opacity={0.85} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.9, 0]}>
        <circleGeometry args={[2.4, 48]} />
        <meshStandardMaterial color="#121214" metalness={0.6} roughness={0.4} />
      </mesh>
      <pointLight position={[0, 0.9, 0]} intensity={6} color="#ff8a3d" distance={7} decay={2} />
    </group>
  )
}

/* ── Boundary so a broken/missing GLB degrades to the stage, never crashes the hero ── */
class SubjectBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

import { scrollSignal } from '../../core/stores/useSceneStore'
import { sceneActivity } from '../../core/scene/sceneDirector'

/** Scene 1 wrapper: presence fades/sinks as the grill takes over (deterministic, reversible). */
function HeroPresence({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const a = sceneActivity(scrollSignal.progress).hero
    g.visible = a > 0.02
    g.scale.setScalar(0.4 + a * 0.6)
    g.position.y = (1 - a) * -2.2
  })
  return <group ref={ref}>{children}</group>
}

export function HeroSubject({
  mode,
  bob,
}: {
  mode: 'model' | 'photo' | 'stage'
  bob: boolean
}) {
  const stage = <EmberStage />
  return (
    <HeroPresence>
      {mode === 'model' ? (
        <SubjectBoundary fallback={stage}>
          <Suspense fallback={stage}>
            <ShawarmaModel url="/models/shawarma.glb" bob={bob} />
          </Suspense>
        </SubjectBoundary>
      ) : mode === 'photo' ? (
        <SubjectBoundary fallback={stage}>
          <Suspense fallback={stage}>
            <PhotoPlate url={CINEMATIC.hero.url} bob={bob} />
          </Suspense>
        </SubjectBoundary>
      ) : (
        stage
      )}
    </HeroPresence>
  )
}
