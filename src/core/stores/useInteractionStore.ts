import { create } from 'zustand'
import { currentScene } from '../scene/sceneDirector'
import { useCollectionStore } from './useCollectionStore'

/**
 * Explicit cinematic interaction states with deterministic transitions.
 * Priority when deriving: CART_OPEN > PRODUCT_SELECTED > MENU_OPEN >
 * TRANSITIONING > EXPLORING > IDLE.
 */
export type InteractionState =
  | 'IDLE'
  | 'TRANSITIONING'
  | 'EXPLORING'
  | 'PRODUCT_SELECTED'
  | 'MENU_OPEN'
  | 'CART_OPEN'

interface InteractionStore {
  state: InteractionState
  /** True while the cart overlay is open (set by the cart store subscribers). */
  cartOpen: boolean
  /** Selected ingredient id (null = none). */
  selected: string | null
  /** Raw master progress; set by the scroll driver. */
  progress: number
  lastScrollAt: number
  derive: () => void
  setProgress: (p: number) => void
  setCartOpen: (v: boolean) => void
  setSelected: (id: string | null) => void
}

const SCROLL_IDLE_MS = 450

export const useInteractionStore = create<InteractionStore>((set, get) => ({
  state: 'IDLE',
  cartOpen: false,
  selected: null,
  progress: 0,
  lastScrollAt: 0,
  setProgress: (p) => {
    set({ progress: p, lastScrollAt: performance.now() })
    get().derive()
  },
  setCartOpen: (v) => {
    set({ cartOpen: v })
    get().derive()
  },
  setSelected: (id) => {
    set({ selected: id })
    get().derive()
  },
  derive: () => {
    const { cartOpen, selected, progress, lastScrollAt } = get()
    const scene = currentScene(progress)
    const scrolling = performance.now() - lastScrollAt >= 0 && performance.now() - lastScrollAt < SCROLL_IDLE_MS
    const collection = useCollectionStore.getState()
    const productOpen = collection.mode !== 'browse' && collection.productId !== null

    let next: InteractionState
    if (cartOpen) next = 'CART_OPEN'
    else if ((selected && scene === 'ingredients') || productOpen) next = 'PRODUCT_SELECTED'
    else if (scene === 'menu') next = 'MENU_OPEN'
    else if (scrolling) next = 'TRANSITIONING'
    else if (scene === 'ingredients' || scene === 'grill' || scene === 'assembly' || scene === 'collection') next = 'EXPLORING'
    else next = 'IDLE'

    if (next !== get().state) set({ state: next })
  },
}))

/** Idle timer so TRANSITIONING decays into EXPLORING/IDLE after scroll stops. */
if (typeof window !== 'undefined') {
  window.setInterval(() => {
    const s = useInteractionStore.getState()
    if (s.state === 'TRANSITIONING' && performance.now() - s.lastScrollAt >= SCROLL_IDLE_MS) {
      s.derive()
    }
  }, 300)
}
