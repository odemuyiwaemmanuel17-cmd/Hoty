import type { CinematicLayerKey } from '../../assets/cinematic/assetManifest'

/**
 * Illustrative ingredient composition for the cinematic breakdown — these are
 * visual storytelling categories, NOT confirmation of the restaurant's actual
 * recipe, options or pricing. Real customization choices must come from the
 * database (product configuration IDs reserved below); visual-only
 * interactions never alter order pricing.
 *
 * `photo` binds each layer to the owner's uploaded, layer-separated recipe
 * photography in the cinematic asset manifest.
 */
export interface IngredientLayer {
  id: string
  name: string
  description: string
  /** Reserved link to a future Firebase product-configuration option id. */
  configKey: string | null
  photo: CinematicLayerKey
  radius: number
  height: number
  color: string
  roughness: number
  metalness: number
  /** Deliberate exploded-composition offset (not random floating). */
  explode: [number, number, number]
  explodeTilt: number
}

export const INGREDIENT_LAYERS: IngredientLayer[] = [
  {
    id: 'flatbread',
    name: 'Toasted Flatbread',
    description: 'Illustrative layer — soft bread charred over the grill. Final recipe per the restaurant.',
    configKey: null,
    photo: 'bread',
    radius: 1.15,
    height: 0.24,
    color: '#d8a86a',
    roughness: 0.85,
    metalness: 0.02,
    explode: [0, -1.5, 0],
    explodeTilt: -0.05,
  },
  {
    id: 'grilled-meat',
    name: 'Grilled Shawarma Meat',
    description: 'Illustrative layer — carved rotisserie filling. Actual meat options come from the menu database.',
    configKey: null,
    photo: 'meat',
    radius: 1.05,
    height: 0.22,
    color: '#8a3d16',
    roughness: 0.5,
    metalness: 0.05,
    explode: [0, -0.35, 0],
    explodeTilt: 0.04,
  },
  {
    id: 'vegetables',
    name: 'Vegetables & Pickles',
    description: 'Illustrative layer — crunch and acidity. Configurable choices will be database-driven.',
    configKey: null,
    photo: 'veg',
    radius: 1.0,
    height: 0.2,
    color: '#5c7a3a',
    roughness: 0.72,
    metalness: 0.02,
    explode: [0, 0.85, 0],
    explodeTilt: -0.04,
  },
  {
    id: 'garlic-sauce',
    name: 'Garlic Sauce',
    description: 'Illustrative layer — creamy signature drizzle. Sauce lineup pending owner confirmation.',
    configKey: null,
    photo: 'sauce',
    radius: 0.96,
    height: 0.2,
    color: '#efe4c8',
    roughness: 0.28,
    metalness: 0.04,
    explode: [0, 1.95, 0],
    explodeTilt: 0.03,
  },
]

/** Assembled stack base positions (y of each layer center). */
export function assembledY(): number[] {
  const ys: number[] = []
  let y = 0
  for (const l of INGREDIENT_LAYERS) {
    y += l.height / 2
    ys.push(y)
    y += l.height / 2
  }
  return ys
}
