import * as THREE from 'three'

/**
 * Runtime-generated PBR companion textures for the LABELLED TEMPORARY scene
 * assets (grill meat cone, ingredient layers, flames). They exist so the
 * cinematic journey is testable before production GLBs/photography arrive via
 * the same asset pipeline; replace by dropping files into /public/models.
 * All canvases are small and generated once, then cached module-level.
 */

const cache = new Map<string, THREE.Texture>()

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  return [c, c.getContext('2d')!]
}

function cached(key: string, build: () => THREE.Texture): THREE.Texture {
  let t = cache.get(key)
  if (!t) {
    t = build()
    cache.set(key, t)
  }
  return t
}

function speckle(
  ctx: CanvasRenderingContext2D,
  size: number,
  count: number,
  colors: string[],
  rMin: number,
  rMax: number,
) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[(Math.random() * colors.length) | 0]
    ctx.beginPath()
    ctx.arc(Math.random() * size, Math.random() * size, rMin + Math.random() * (rMax - rMin), 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Grilled rotisserie meat: caramelised base, char streaks, glistening fat. */
export function meatTexture(): THREE.Texture {
  return cached('meat', () => {
    const size = 512
    const [c, ctx] = makeCanvas(size)
    const g = ctx.createLinearGradient(0, 0, 0, size)
    g.addColorStop(0, '#9a4a1a')
    g.addColorStop(0.55, '#7e3512')
    g.addColorStop(1, '#5f260d')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    // stacked meat folds
    for (let y = 0; y < size; y += 7 + Math.random() * 9) {
      ctx.strokeStyle = `rgba(${40 + Math.random() * 40 | 0},${18 + Math.random() * 16 | 0},8,${0.25 + Math.random() * 0.3})`
      ctx.lineWidth = 1.5 + Math.random() * 2.5
      ctx.beginPath()
      ctx.moveTo(0, y)
      for (let x = 0; x <= size; x += 32) ctx.lineTo(x, y + (Math.random() - 0.5) * 6)
      ctx.stroke()
    }
    // char marks + fat glisten
    speckle(ctx, size, 240, ['#2b1206', '#3a1a08', '#c98a4b', '#e8b070'], 1, 5)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    return t
  })
}

/** Toasted flatbread with char blisters. */
export function breadTexture(): THREE.Texture {
  return cached('bread', () => {
    const size = 256
    const [c, ctx] = makeCanvas(size)
    ctx.fillStyle = '#d8a86a'
    ctx.fillRect(0, 0, size, size)
    speckle(ctx, size, 130, ['#b9834a', '#8a5a2e', '#e6c08a', '#6e4520'], 1, 7)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })
}

/** Mixed vegetables & pickles chunk pattern — salad colors from the reference wraps. */
export function vegTexture(): THREE.Texture {
  return cached('veg', () => {
    const size = 256
    const [c, ctx] = makeCanvas(size)
    ctx.fillStyle = '#5c7a3a'
    ctx.fillRect(0, 0, size, size)
    speckle(ctx, size, 160, ['#3f5a26', '#89a852', '#e8e2cf', '#d84022', '#7fae55', '#8e3d6b', '#e88b2a'], 2, 9)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })
}

/** Grilled flatbread wrap skin: blistered char streaks like the reference photos. */
export function wrapSkinTexture(): THREE.Texture {
  return cached('wrapskin', () => {
    const w = 512
    const h = 256
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#e0b071')
    g.addColorStop(0.5, '#d29e5c')
    g.addColorStop(1, '#c08a4a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // diagonal grill char streaks
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = `rgba(${90 + Math.random() * 40 | 0},${50 + Math.random() * 25 | 0},20,${0.12 + Math.random() * 0.2})`
      ctx.lineWidth = 3 + Math.random() * 7
      ctx.beginPath()
      const x = Math.random() * w
      ctx.moveTo(x, 0)
      ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 80, h / 2, x + (Math.random() - 0.5) * 140, h)
      ctx.stroke()
    }
    // toasted blisters + sesame-like pale flecks (respect non-square canvas)
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = ['#8a5a2e', '#6e4520', '#f0d9a8', '#b9834a'][(Math.random() * 4) | 0]
      ctx.beginPath()
      ctx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 5, 0, Math.PI * 2)
      ctx.fill()
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    return t
  })
}

/** Cut-face cross-section: concentric layers (sauce, greens, tomato, onion, meat core). */
export function wrapCutTexture(): THREE.Texture {
  return cached('wrapcut', () => {
    const size = 256
    const [c, ctx] = makeCanvas(size)
    const cx = size / 2
    const rings: [number, string][] = [
      [126, '#d8a86a'], // bread edge
      [116, '#efe4c8'], // garlic sauce
      [104, '#7fae55'], // lettuce green
      [90, '#d84022'], // tomato red
      [74, '#8e3d6b'], // pickled onion purple
      [58, '#9a4a1a'], // shawarma meat
      [30, '#c98a4b'], // meat center highlight
    ]
    ctx.fillStyle = '#b9834a'
    ctx.fillRect(0, 0, size, size)
    for (const [r, col] of rings) {
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.arc(cx, cx, r, 0, Math.PI * 2)
      ctx.fill()
    }
    // organic speckle across the filling
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cx, 112, 0, Math.PI * 2)
    ctx.clip()
    speckle(ctx, size, 90, ['#e8e2cf', '#3f5a26', '#e88b2a', '#5f260d'], 2, 7)
    ctx.restore()
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })
}

/** Dark char-grill hall floor with warm sheen. */
export function hallFloorTexture(): THREE.Texture {
  return cached('floor', () => {
    const size = 256
    const [c, ctx] = makeCanvas(size)
    ctx.fillStyle = '#0e0f12'
    ctx.fillRect(0, 0, size, size)
    speckle(ctx, size, 60, ['#17181d', '#101216', '#1d1a16'], 4, 22)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(6, 3)
    return t
  })
}

/** Soft radial flame/ember sprite. */
export function flameTexture(): THREE.Texture {
  return cached('flame', () => {
    const size = 128
    const [c, ctx] = makeCanvas(size)
    const g = ctx.createRadialGradient(size / 2, size * 0.62, 3, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(255,230,150,0.95)')
    g.addColorStop(0.35, 'rgba(255,140,40,0.6)')
    g.addColorStop(1, 'rgba(255,90,10,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })
}

export function disposeProceduralTextures() {
  cache.forEach((t) => t.dispose())
  cache.clear()
}
