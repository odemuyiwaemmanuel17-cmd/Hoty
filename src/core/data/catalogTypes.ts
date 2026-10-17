/** Catalog/commerce types. Prices are integer kobo everywhere. */

export interface ProductOption {
  id: string
  groupId: string
  name: string
  priceKobo: number
  /** Asset support for 3D/visual representation; null → schematic-only, no fake visuals. */
  assetKey: OptionAssetKey | null
  incompatibleWith?: string[]
}

export type OptionAssetKey =
  | 'meat-chicken'
  | 'meat-beef'
  | 'meat-mixed'
  | 'sauce-garlic'
  | 'sauce-hot'
  | 'sauce-tahini'
  | 'size-regular'
  | 'size-large'
  | 'extra-fries'
  | 'extra-cheese'

export interface OptionGroup {
  id: string
  name: string
  /** 0 = optional; ≥1 = minimum selections required. */
  min: number
  /** Max selectable; Infinity handled as null in data. */
  max: number
  optionIds: string[]
}

export interface Product {
  id: string
  name: string
  description?: string
  priceKobo: number
  currency: 'NGN'
  category: string
  available: boolean
  image?: string
  model?: string
  /** True for clearly-labelled demo entries (no real restaurant data invented). */
  demo: boolean
  /** Option groups for customizable products (shawarma configurator). */
  groups?: OptionGroup[]
}

export interface CatalogSnapshot {
  source: 'demo' | 'firebase'
  products: Product[]
  options: ProductOption[]
  fetchedAt: number
}
