import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollSignal } from '../../core/stores/useSceneStore'

/**
 * Declarative visibility gate: mounts children once (assets stay cached) and
 * toggles group visibility from master progress — no remounts on scene
 * transitions, cheap in both scroll directions.
 */
export function ProgressGate({
  from,
  to,
  children,
}: {
  from: number
  to: number
  children: ReactNode
}) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const p = scrollSignal.progress
    const on = p >= from && p <= to
    if (g.visible !== on) g.visible = on
  })
  return (
    <group ref={ref} visible={from <= 0}>
      {children}
    </group>
  )
}
