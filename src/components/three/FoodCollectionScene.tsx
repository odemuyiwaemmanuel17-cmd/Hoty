import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { SCENE_ORIGINS } from '../../core/scene/sceneRegistry'
import { sceneActivity } from '../../core/scene/sceneDirector'
import { scrollSignal, useSceneStore } from '../../core/stores/useSceneStore'
import { useCatalogStore } from '../../core/stores/useCatalogStore'
import { EMPTY_PRODUCTS } from '../ui/CollectionOverlay'
import { useCollectionStore } from '../../core/stores/useCollectionStore'
import { useCartStore } from '../../core/stores/useCartStore'
import { formatNaira } from '../../core/commerce/money'
import { probeAsset } from '../../core/hooks/assetProbe'
import { flameTexture, hallFloorTexture, wrapCutTexture, wrapSkinTexture } from '../../core/three/proceduralTextures'

/**
 * Scene 5 — cinematic product collection.
 * Products render as dark display pedestals with a schematic token + label
 * (real product photography via `image` and GLB via `model` upgrade each
 * token automatically when the catalog provides them). Selecting a product
 * glides it toward the camera while the others recede — scroll position is
 * untouched; this is an overlay mode on the same Canvas.
 */

const CATEGORY_TINT: Record<string, string> = {
  Wraps: '#ff6b18',
  Plates: '#f5b93e',
  Drinks: '#4a9ad8',
}

function ImagePlate({ url }: { url: string }) {
  const tex = useLoader(THREE.TextureLoader, url)
  tex.colorSpace = THREE.SRGBColorSpace
  // Fit the real photo's aspect inside the pedestal frame — never stretch it.
  const { w, h } = useMemo(() => {
    const img = tex.image as HTMLImageElement | undefined
    const aspect = img && img.height ? img.width / img.height : 0.79
    let h = 1.3
    let w = h * aspect
    if (w > 1.15) {
      w = 1.15
      h = w / aspect
    }
    return { w, h }
  }, [tex])
  return (
    <mesh position={[0, 0.35, 0]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  )
}

/** Only load a product photo once it actually exists (404s must never crash the Canvas). */
function useProbedImage(url?: string): string | null {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    if (!url) return
    let cancelled = false
    probeAsset(url, 'image').then((v) => !cancelled && setOk(v))
    return () => { cancelled = true }
  }, [url])
  return url && ok ? url : null
}

/**
 * Stylized wrap token inspired by the reference photography: grilled flatbread
 * skin with char streaks, white paper sleeve, and a layered cut face showing
 * sauce, greens, tomato, pickled onion and meat. A labelled schematic stand-in
 * until real product photography or GLB assets arrive.
 */
function WrapToken({ available }: { available: boolean }) {
  const skin = useMemo(() => {
    const t = wrapSkinTexture()
    t.repeat.set(2, 1)
    return t
  }, [])
  const cut = useMemo(wrapCutTexture, [])
  const tilt = 0.5
  const half = 0.625
  const topY = half * Math.cos(tilt)
  const topZ = half * Math.sin(tilt)

  return (
    <group rotation={[0, 0, -0.1]}>
      <mesh rotation={[tilt, 0, 0]} position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.3, 0.34, 1.25, 36]} />
        <meshStandardMaterial
          map={skin}
          color={available ? '#ffffff' : '#4c4c50'}
          roughness={0.72}
          metalness={0.02}
        />
      </mesh>
      {/* white paper sleeve */}
      <mesh rotation={[tilt, 0, 0]} position={[0, 0.32 - 0.3, -0.15]}>
        <cylinderGeometry args={[0.325, 0.36, 0.62, 36]} />
        <meshStandardMaterial color="#e9e4da" roughness={0.92} metalness={0} />
      </mesh>
      {/* cut face */}
      <mesh rotation={[-(Math.PI / 2 - tilt), 0, 0]} position={[0, 0.32 + topY, topZ]}>
        <circleGeometry args={[0.3, 36]} />
        <meshBasicMaterial map={cut} toneMapped={false} />
      </mesh>
    </group>
  )
}

function ProductToken({ index, count, productId }: { index: number; count: number; productId: string }) {
  const product = useCatalogStore((s) => s.snapshot?.products.find((p) => p.id === productId))!
  const group = useRef<THREE.Group>(null)
  const mode = useCollectionStore((s) => s.mode)
  const selectedId = useCollectionStore((s) => s.productId)
  const openDetail = useCollectionStore((s) => s.openDetail)
  const hovered = useRef(false)

  const spread = Math.min(1.9, 7 / Math.max(count, 1))
  const baseX = (index - (count - 1) / 2) * spread
  const baseZ = -Math.abs(index - (count - 1) / 2) * 0.4
  const labelY = 1.15 + (index % 2) * 0.55 // stagger so narrow screens never overlap
  const tint = CATEGORY_TINT[product.category] ?? '#ff8a3d'
  const photo = useProbedImage(product.image)
  // drei <Html> ignores parent visibility — gate labels on React state so they
  // never bleed into other scenes (throttled: only flips at activity thresholds).
  const [labelsOn, setLabelsOn] = useState(false)

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const on = sceneActivity(scrollSignal.progress).collection > 0.15
    if (on !== labelsOn) setLabelsOn(on)
    const ease = 1 - Math.pow(0.001, dt)
    const focused = (mode === 'detail' || mode === 'configure') && selectedId === product.id
    const dimmed = (mode === 'detail' || mode === 'configure') && !focused
    const tx = focused ? 0 : baseX
    const ty = focused ? 1.15 : 0 + (dimmed ? -0.15 : 0)
    const tz = focused ? 3.4 : baseZ + (dimmed ? -1.4 : hovered.current ? 0.25 : 0)
    const ts = focused ? 1.35 : dimmed ? 0.82 : 1
    g.position.x = THREE.MathUtils.lerp(g.position.x, tx, ease)
    g.position.y = THREE.MathUtils.lerp(g.position.y, ty, ease)
    g.position.z = THREE.MathUtils.lerp(g.position.z, tz, ease)
    g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, ts, ease))
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, focused ? 0 : -baseX * 0.08, ease)
  })

  if (!product) return null
  const interactive = sceneActivity(scrollSignal.progress).collectionActive && !useCartStore.getState().isOpen

  return (
    <group ref={group} position={[baseX, 0, baseZ]}>
      {/* pedestal */}
      <mesh position={[0, -0.42, 0]}>
        <cylinderGeometry args={[0.62, 0.7, 0.14, 40]} />
        <meshStandardMaterial color="#17181c" metalness={0.75} roughness={0.35} />
      </mesh>
      <mesh position={[0, -0.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.55, 0.012, 12, 60]} />
        <meshBasicMaterial color={tint} toneMapped={false} transparent opacity={product.available ? 0.85 : 0.25} />
      </mesh>
      {/* product visual: photo plate when the catalog supplies one, otherwise a
          schematic token (GLB via `model` uses the same pipeline as the hero). */}
      <group
        onClick={(e) => { e.stopPropagation(); if (interactive) openDetail(product.id) }}
        onPointerOver={(e) => { e.stopPropagation(); hovered.current = true; if (interactive) document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { hovered.current = false; document.body.style.cursor = '' }}
      >
        {photo ? (
          <Suspense fallback={null}>
            <ImagePlate url={photo} />
          </Suspense>
        ) : (
          <WrapToken available={product.available} />
        )}
      </group>
      {labelsOn && (
      <Html position={[0, labelY, 0]} center distanceFactor={7} zIndexRange={[20, 0]}>
        <div className="pointer-events-none w-36 select-none text-center">
          <p className="truncate font-[family-name:var(--font-display)] text-lg text-cream" style={{ textShadow: '0 2px 8px #000' }}>
            {product.name}
          </p>
          <p className="truncate text-[11px] tracking-widest" style={{ color: product.available ? tint : '#8a8578' }}>
            {product.available ? `${formatNaira(product.priceKobo)} · demo` : 'unavailable · demo'}
          </p>
        </div>
      </Html>
      )}
    </group>
  )
}

export function FoodCollectionScene() {
  const group = useRef<THREE.Group>(null)
  const products = useCatalogStore((s) => s.snapshot?.products ?? EMPTY_PRODUCTS)
  const quality = useSceneStore((s) => s.quality)
  const ids = useMemo(() => products.map((p) => p.id), [products])
  const floor = useMemo(hallFloorTexture, [])
  const glow = useMemo(flameTexture, [])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const a = sceneActivity(scrollSignal.progress).collection
    const on = a > 0.01
    if (g.visible !== on) g.visible = on
    if (!on) return
    g.scale.setScalar(0.92 + a * 0.08)
  })

  return (
    <group ref={group} position={[SCENE_ORIGINS.collection.x, 0, SCENE_ORIGINS.collection.z]} visible={false}>
      {/* hall floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, -0.5]}>
        <planeGeometry args={[20, 12]} />
        <meshStandardMaterial map={floor} color="#1a1b1f" metalness={0.55} roughness={0.5} />
      </mesh>
      {/* warm backlight haze behind the arc */}
      <sprite position={[0, 1.6, -2.2]} scale={[14, 8, 1]}>
        <spriteMaterial map={glow} transparent opacity={0.14} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {/* hall backdrop */}
      <mesh position={[0, 1.6, -2.6]}>
        <planeGeometry args={[16, 6]} />
        <meshStandardMaterial color="#101114" metalness={0.6} roughness={0.5} />
      </mesh>
      <pointLight position={[0, 3, 2.5]} intensity={22} color="#ffb46b" distance={14} decay={2} />
      <pointLight position={[-3.5, 1.2, 1]} intensity={9} color="#ff6b18" distance={10} decay={2} />
      <pointLight position={[3.5, 1.2, 1]} intensity={9} color="#ff6b18" distance={10} decay={2} />
      {quality !== 'low' && ids.map((id, i) => <ProductToken key={id} index={i} count={ids.length} productId={id} />)}
      {quality === 'low' && ids.slice(0, 3).map((id, i) => <ProductToken key={id} index={i} count={Math.min(ids.length, 3)} productId={id} />)}
    </group>
  )
}
