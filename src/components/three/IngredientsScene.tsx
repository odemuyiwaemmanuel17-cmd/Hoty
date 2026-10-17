import { useMemo, useRef } from 'react'
import { useFrame, useLoader, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { INGREDIENT_LAYERS, assembledY } from '../../core/data/ingredients'
import { cameraNudge } from '../../core/scene/cameraNudge'
import { SCENE_ORIGINS } from '../../core/scene/sceneRegistry'
import { sceneActivity } from '../../core/scene/sceneDirector'
import { scrollSignal } from '../../core/stores/useSceneStore'
import { useInteractionStore } from '../../core/stores/useInteractionStore'
import { useCartStore } from '../../core/stores/useCartStore'
import { CINEMATIC, fitAsset } from '../../assets/cinematic/assetManifest'

/**
 * Scene 3 — exploded ingredients, built from the owner's uploaded
 * layer-separated recipe photography (background keyed out of the exploded
 * reference). Each layer is a sharp, undistorted photo plane on a
 * scroll-driven separation timeline; the dark airburst reference floats
 * behind as atmosphere. Interactions (hover, tap-to-focus, reverse-scroll
 * reassembly) are unchanged.
 */

function useLayerTextures() {
  const urls = useMemo(() => {
    const list: string[] = INGREDIENT_LAYERS.map(
      (l) => CINEMATIC.layers[l.photo as keyof typeof CINEMATIC.layers].url,
    )
    list.push(CINEMATIC.airburst.url)
    return list
  }, [])
  const texs = useLoader(THREE.TextureLoader, urls) as THREE.Texture[]
  useMemo(() => {
    texs.forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace
    })
  }, [texs])
  return texs
}

export function IngredientsScene() {
  const group = useRef<THREE.Group>(null)
  const layerRefs = useRef<(THREE.Mesh | null)[]>([])
  const mats = useRef<THREE.MeshBasicMaterial[]>([])
  const hovered = useRef<string | null>(null)
  const ys = useMemo(assembledY, [])
  const texs = useLayerTextures()
  const backdropTex = texs[texs.length - 1]

  const presence = () => sceneActivity(scrollSignal.progress).ingredients

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const a = sceneActivity(scrollSignal.progress)
    const on = a.ingredients > 0.01
    if (g.visible !== on) g.visible = on
    if (!on) {
      if (cameraNudge.look) cameraNudge.look = null
      return
    }
    g.position.y = SCENE_ORIGINS.ingredients.y + (1 - a.ingredients) * -0.8
    g.scale.setScalar(0.9 + a.ingredients * 0.1)

    const e = a.explode
    const sel = useInteractionStore.getState().selected
    const ease = 1 - Math.pow(0.001, dt)

    INGREDIENT_LAYERS.forEach((l, i) => {
      const m = layerRefs.current[i]
      if (!m) return
      const targetY = ys[i] + l.explode[1] * e
      m.position.y = THREE.MathUtils.lerp(m.position.y, targetY, ease)
      m.position.x = THREE.MathUtils.lerp(m.position.x, l.explode[0] * e, ease)
      m.position.z = THREE.MathUtils.lerp(m.position.z, l.explode[2] * e, ease)
      m.rotation.z = THREE.MathUtils.lerp(m.rotation.z, l.explodeTilt * e, ease)
      // gentle depth parallax instead of spinning a photograph
      m.rotation.y = THREE.MathUtils.lerp(m.rotation.y, e * (i % 2 === 0 ? 0.12 : -0.12), ease)

      const mat = mats.current[i]
      if (mat) {
        const boost = sel === l.id ? 0.5 : hovered.current === l.id ? 0.28 : 0
        const k = 1 + boost
        mat.color.lerp(new THREE.Color(k, k * 0.94, k * 0.86), ease * 1.6)
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, 1, ease * 2)
      }
    })

    if (sel) {
      const i = INGREDIENT_LAYERS.findIndex((l) => l.id === sel)
      const m = layerRefs.current[i]
      if (m) {
        const world = m.getWorldPosition(new THREE.Vector3())
        cameraNudge.look = world
        cameraNudge.dolly = 0.1
      }
    } else {
      cameraNudge.look = null
      cameraNudge.dolly = 0
    }
  })

  const interactive = () =>
    presence() > 0.55 && !useCartStore.getState().isOpen && useInteractionStore.getState().state !== 'CART_OPEN'

  const onClick = (id: string) => (ev: ThreeEvent<MouseEvent>) => {
    ev.stopPropagation()
    if (!interactive()) return
    const store = useInteractionStore.getState()
    store.setSelected(store.selected === id ? null : id)
  }

  return (
    <group ref={group} position={[SCENE_ORIGINS.ingredients.x, SCENE_ORIGINS.ingredients.y, SCENE_ORIGINS.ingredients.z]} visible={false}>
      {/* atmosphere: the uploaded ingredient airburst, dimmed behind the stack */}
      <mesh position={[0, 1.4, -2.6]}>
        <planeGeometry args={[fitAsset(CINEMATIC.airburst, 6.4, 6.4).w, fitAsset(CINEMATIC.airburst, 6.4, 6.4).h]} />
        <meshBasicMaterial map={backdropTex} transparent opacity={0.13} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* pedestal */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.16, 0]}>
        <circleGeometry args={[2.2, 48]} />
        <meshStandardMaterial color="#141518" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.14, 0]}>
        <ringGeometry args={[1.5, 1.58, 64]} />
        <meshBasicMaterial color="#ff6b18" transparent opacity={0.5} toneMapped={false} />
      </mesh>

      {INGREDIENT_LAYERS.map((l, i) => {
        const asset = CINEMATIC.layers[l.photo]
        const size = fitAsset(asset, 2.35, 0.95)
        return (
          <mesh
            key={l.id}
            ref={(m) => (layerRefs.current[i] = m)}
            position={[0, ys[i], 0]}
            onPointerOver={(e) => {
              e.stopPropagation()
              if (interactive()) {
                hovered.current = l.id
                document.body.style.cursor = 'pointer'
              }
            }}
            onPointerOut={() => {
              if (hovered.current === l.id) {
                hovered.current = null
                document.body.style.cursor = ''
              }
            }}
            onClick={onClick(l.id)}
          >
            <planeGeometry args={[size.w, size.h]} />
            <meshBasicMaterial
              ref={(mat) => {
                if (mat) mats.current[i] = mat
              }}
              map={texs[i]}
              transparent
              toneMapped={false}
            />
          </mesh>
        )
      })}

      <pointLight position={[0, 3.2, 2.4]} intensity={9} color="#ffb46b" distance={9} decay={2} />
      <pointLight position={[-2.4, 1, -1.6]} intensity={5} color="#ff6b18" distance={8} decay={2} />
    </group>
  )
}
