import { create } from 'zustand'
import { fetchCatalog, hasRemoteCatalog } from '../data/menuSource'
import type { CatalogSnapshot, Product, ProductOption } from '../data/catalogTypes'

interface CatalogState {
  status: 'loading' | 'ready' | 'error'
  snapshot: CatalogSnapshot | null
  load: () => Promise<void>
  productById: (id: string) => Product | undefined
  optionsById: () => Map<string, ProductOption>
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  status: 'loading',
  snapshot: null,
  async load() {
    if (get().status === 'ready') return
    set({ status: 'loading' })
    try {
      const snapshot = await fetchCatalog()
      set({ snapshot, status: 'ready' })
    } catch {
      set({ status: 'error' })
    }
  },
  productById: (id) => get().snapshot?.products.find((p) => p.id === id),
  optionsById: () => new Map((get().snapshot?.options ?? []).map((o) => [o.id, o])),
}))

export { hasRemoteCatalog }
