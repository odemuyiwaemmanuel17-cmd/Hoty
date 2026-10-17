import { create } from 'zustand'

/**
 * Food collection / product detail / configurator mode.
 * Entering or leaving detail never scrolls the page — scroll position is
 * preserved by construction (this is an overlay mode, not a route).
 */
export type CollectionMode = 'browse' | 'detail' | 'configure'

interface CollectionState {
  mode: CollectionMode
  productId: string | null
  openDetail: (id: string) => void
  startConfigure: () => void
  back: () => void
  close: () => void
}

export const useCollectionStore = create<CollectionState>((set) => ({
  mode: 'browse',
  productId: null,
  openDetail: (id) => set({ mode: 'detail', productId: id }),
  startConfigure: () => set({ mode: 'configure' }),
  back: () => set((s) => ({ mode: s.mode === 'configure' ? 'detail' : 'browse' })),
  close: () => set({ mode: 'browse', productId: null }),
}))
