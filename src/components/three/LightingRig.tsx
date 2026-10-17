import { useRef } from 'react'
import { Environment, Lightformer } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Dark ambient base + warm orange rim. Lightformers build the environment
 * map in-engine (no external HDR download) so PBR materials stay convincing
 * offline. Rim group parallaxes subtly with the pointer.
 */
export function LightingRig({ envResolution = 128 }: { envResolution?: number }) {
  const rimRef = useRef<THREE.Group>(null)

  useFrame(({ pointer }, dt) => {
    const g = rimRef.current
    if (!g) return
    const ease = 1 - Math.pow(0.01, dt)
    g.position.x = THREE.MathUtils.lerp(g.position.x, pointer.x * 0.9, ease)
    g.position.y = THREE.MathUtils.lerp(g.position.y, 0.6 + pointer.y * 0.35, ease)
  })

  return (
    <>
      <ambientLight intensity={0.16} color="#1d1b20" />
      <directionalLight position={[2.5, 4, 3]} intensity={0.9} color="#ffe0c2" />
      {/* fire rim */}
      <group ref={rimRef}>
        <pointLight position={[-2.6, 0.4, -2.2]} intensity={14} color="#ff6b18" distance={12} decay={2} />
        <spotLight
          position={[0, 3.4, -3.2]}
          angle={0.6}
          penumbra={1}
          intensity={22}
          color="#ff8a3d"
          distance={14}
          decay={2}
        />
      </group>
      {/* cool counterpoint so the orange reads hot */}
      <pointLight position={[3.4, 1.6, 2.6]} intensity={3.2} color="#4a5a78" distance={10} decay={2} />

      <Environment resolution={envResolution}>
        <Lightformer form="rect" intensity={2.4} color="#ff6b18" position={[-3, 1, -3]} scale={[4, 3, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.1} color="#ff8a3d" position={[3, 2, -2]} scale={[3, 2.4, 1]} target={[0, 0, 0]} />
        <Lightformer form="circle" intensity={0.5} color="#33415c" position={[0, 4, 3]} scale={[5, 5, 1]} target={[0, 0, 0]} />
      </Environment>
    </>
  )
}
