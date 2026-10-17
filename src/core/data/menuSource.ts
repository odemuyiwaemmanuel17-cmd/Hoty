import type { CatalogSnapshot, Product, ProductOption } from './catalogTypes'
import { DEMO_PRODUCTS, DEMO_OPTIONS } from './demoCatalog'
import { backend } from '../config/env'

/**
 * Firebase integration point for the product catalog.
 * Expected collections: categories, products, option_groups, product_options
 * (see firestore.rules + functions/). Without env config the app serves the
 * clearly-labelled DEMO catalog — never presented as real menu data.
 * Admin menu edits write to these same collections, so the customer menu
 * always reflects the authoritative source. Only the public web config is
 * used; rules restrict reads to non-archived products.
 */
export const hasRemoteCatalog = backend.configured

export async function fetchCatalog(): Promise<CatalogSnapshot> {
  if (backend.configured) {
    const { getFb } = await import('../admin/firebaseClient')
    const fb = await getFb()
    if (!fb) throw new Error('Backend unavailable.')
    const { collection, getDocs, query, where } = await import('firebase/firestore')
    const [pSnap, gSnap, oSnap] = await Promise.all([
      getDocs(query(collection(fb.db, 'products'), where('archived', '==', false))),
      getDocs(collection(fb.db, 'option_groups')),
      getDocs(collection(fb.db, 'product_options')),
    ])
    const options: ProductOption[] = oSnap.docs.map((s) => {
      const o = s.data() as Record<string, unknown>
      return {
        id: s.id,
        groupId: String(o.group_id),
        name: String(o.name),
        priceKobo: Number(o.price_kobo ?? 0),
        assetKey: (o.asset_key as ProductOption['assetKey']) ?? null,
        incompatibleWith: (o.incompatible_with as string[]) ?? undefined,
      }
    })
    const products: Product[] = pSnap.docs.map((s) => {
      const r = s.data() as Record<string, unknown>
      return {
        id: s.id,
        name: String(r.name ?? ''),
        description: (r.description as string | null) ?? undefined,
        priceKobo: Number(r.price_kobo ?? 0),
        currency: 'NGN',
        category: String(r.category ?? 'Menu'),
        available: r.available !== false,
        image: (r.image_url as string | null) ?? undefined,
        model: (r.model_url as string | null) ?? undefined,
        demo: false,
      }
    })
    // attach option groups (min/max + their options)
    const byProduct = new Map<string, { id: string; name: string; min: number; max: number; optionIds: string[] }>()
    for (const s of gSnap.docs) {
      const g = s.data() as Record<string, unknown>
      byProduct.set(String(g.product_id), {
        id: s.id,
        name: String(g.name),
        min: Number(g.min_selections ?? 0),
        max: Number(g.max_selections ?? 1),
        optionIds: options.filter((o) => o.groupId === s.id).map((o) => o.id),
      })
    }
    for (const p of products) {
      const g = byProduct.get(p.id)
      if (g) p.groups = [g]
    }
    return { source: 'firebase', products, options, fetchedAt: Date.now() }
  }

  return { source: 'demo', products: DEMO_PRODUCTS, options: DEMO_OPTIONS, fetchedAt: Date.now() }
}
