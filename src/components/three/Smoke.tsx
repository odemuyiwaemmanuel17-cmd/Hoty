import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function makeSoftTexture(): THREE.Texture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(220,210,200,0.55)')
  g.addColorStop(0.55, 'rgba(200,190,180,0.16)')
  g.addColorStop(1, 'rgba(200,190,180,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

interface SpriteState {
  mesh: THREE.Sprite | null
  seed: number
  baseX: number
  baseZ: number
}

/** Low-cost volumetric hint: a handful of soft rising sprites, not full sim smoke. */
export function Smoke({
  count = 10,
  position = [0, 0, 0] as [number, number, number],
  scale = 1,
}: {
  count?: number
  position?: [number, number, number]
  scale?: number
}) {
  const texture = useMemo(makeSoftTexture, [])
  const items = useRef<SpriteState[]>(
    Array.from({ length: count }, () => ({ mesh: null, seed: Math.random() * 10, baseX: 0, baseZ: 0 })),
  )

  useEffect(() => () => texture.dispose(), [texture])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (const it of items.current) {
      if (!it.mesh) continue
      const cycle = (t * 0.05 + it.seed * 0.37) % 1
      it.mesh.position.y = -0.4 + cycle * 3.2
      it.mesh.position.x = it.baseX + Math.sin(t * 0.25 + it.seed) * 0.35
      it.mesh.position.z = it.baseZ + Math.cos(t * 0.2 + it.seed) * 0.2
      const s = 1.1 + cycle * 2.6
      it.mesh.scale.set(s, s, 1)
      ;(it.mesh.material as THREE.SpriteMaterial).opacity =
        Math.sin(cycle * Math.PI) * 0.09
    }
  })

  return (
    <group position={position} scale={scale}>
      {items.current.map((it, i) => (
        <sprite
          key={i}
          ref={(m) => {
            it.mesh = m
            if (m) {
              const a = (i / count) * Math.PI * 2
              it.baseX = Math.cos(a) * (0.5 + (i % 3) * 0.5)
              it.baseZ = Math.sin(a) * 0.7 - 0.4
              m.position.set(it.baseX, 0, it.baseZ)
            }
          }}
        >
          <spriteMaterial map={texture} transparent depthWrite={false} opacity={0.08} />
        </sprite>
      ))}
    </group>
  )
}
