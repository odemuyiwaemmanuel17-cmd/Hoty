/**
 * Centralized cinematic asset manifest.
 * All entries are processed copies of the owner-uploaded reference imagery
 * (originals preserved untouched in /public/images/_src2/). Production files
 * are WebP with alpha where cut-outs were extracted.
 *
 * Every major visual component must reference this manifest — no scattered
 * hardcoded image paths.
 */

export interface CinematicAsset {
  url: string
  /** intrinsic pixel size — used for aspect-correct plates, never stretch photos */
  w: number
  h: number
}

const a = (url: string, w: number, h: number): CinematicAsset => ({ url, w, h })

export const CINEMATIC = {
  /** 01 — beef wrap on dark slate, spice burst, smoke, ember bokeh (16:9) */
  hero: a('/images/cinematic/hero.webp', 1565, 892),
  /** 02 — vertical rotisserie cone with heat panels and carving knife */
  grill: a('/images/cinematic/grill-rotisserie.webp', 876, 886),
  /** 04 — upright wrap wreathed in flame and smoke (portrait) */
  fireWrap: a('/images/cinematic/fire-wrap.webp', 770, 900),
  /** 09 — dark ingredient airburst (ingredients scene backdrop) */
  airburst: a('/images/cinematic/ingredient-airburst.webp', 904, 902),
  /** 05 — cone wrap with ingredients flying in (assembly scene) */
  assembly: a('/images/cinematic/assembly.webp', 956, 818),
  /** 11 — candlelit plated wrap (visit/footer atmosphere) */
  dine: a('/images/cinematic/dine-plate.webp', 1280, 854),
  /** 07 — exploded layer stack, background keyed out, sliced into layers */
  layers: {
    sauce: a('/images/cinematic/ingredient-sauce.webp', 410, 159),
    veg: a('/images/cinematic/ingredient-veg.webp', 410, 109),
    meat: a('/images/cinematic/ingredient-meat.webp', 410, 135),
    bread: a('/images/cinematic/ingredient-bread.webp', 410, 180),
  },
  /** product photography for the collection/catalog */
  products: {
    'demo-shawarma-custom': a('/images/cinematic/prod-custom.webp', 656, 892),
    'demo-chicken-wrap': a('/images/cinematic/prod-chicken.webp', 1100, 886),
    'demo-beef-wrap': a('/images/cinematic/prod-beef.webp', 1280, 710),
    'demo-plate': a('/images/cinematic/prod-plate.webp', 1227, 891),
    'demo-mixed-jumbo': a('/images/cinematic/prod-jumbo.webp', 1280, 859),
  } satisfies Record<string, CinematicAsset>,
} as const

/** Aspect-correct plate size fitted inside a bounding box (never distorts). */
export function fitAsset(asset: CinematicAsset, maxW: number, maxH: number) {
  const aspect = asset.w / asset.h
  let h = maxH
  let w = h * aspect
  if (w > maxW) {
    w = maxW
    h = w / aspect
  }
  return { w, h }
}

export type CinematicLayerKey = keyof typeof CINEMATIC.layers
