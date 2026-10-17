import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product, ProductOption } from '../data/catalogTypes'
import {
  configSignature,
  configUnitKobo,
  selectedOptionIds,
  type Selections,
} from '../commerce/configurator'
import { addKobo, mulKobo } from '../commerce/money'

/**
 * Cart engine v2 — integer kobo, configuration signatures.
 * Identical configurations merge; different configurations stay separate.
 * Displayed totals are provisional until checkout revalidation.
 */
export interface CartLine {
  /** configuration signature: productId + sorted option ids */
  key: string
  productId: string
  /** name snapshot at add-time */
  name: string
  qty: number
  selections: Selections
  optionIds: string[]
  optionsLabel: string
  /** unit price snapshot (kobo) at add-time */
  unitKobo: number
}

interface CartState {
  lines: CartLine[]
  isOpen: boolean
  /** bump to trigger cart-icon animation; carries the line key */
  lastAdded: { key: string; at: number } | null
  addConfigured: (product: Product, options: ProductOption[], selections: Selections, qty?: number) => CartLine['key']
  removeLine: (key: string) => void
  setQty: (key: string, qty: number) => void
  clear: () => void
  open: () => void
  close: () => void
  totalKobo: () => number
  totalQty: () => number
  toCheckoutEntries: () => { productId: string; name: string; qty: number; selections: Selections; snapshotUnitKobo: number }[]
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      isOpen: false,
      lastAdded: null,

      addConfigured: (product, options, selections, qty = 1) => {
        const key = configSignature(product.id, selections)
        const unitKobo = configUnitKobo(product, options, selections)
        const optById = new Map(options.map((o) => [o.id, o]))
        const optionIds = selectedOptionIds(selections)
        const optionsLabel = optionIds.map((id) => optById.get(id)?.name ?? id).join(', ')
        // invalid/absent quantities collapse to 1; hard cap 99 per line
        const n = Number.isInteger(qty) && qty >= 1 ? Math.min(qty, 99) : 1
        set((s) => {
          const found = s.lines.find((l) => l.key === key)
          const lines = found
            ? s.lines.map((l) => (l.key === key ? { ...l, qty: Math.min(l.qty + n, 99) } : l))
            : [
                ...s.lines,
                { key, productId: product.id, name: product.name, qty: n, selections, optionIds, optionsLabel, unitKobo },
              ]
          return { lines, lastAdded: { key, at: Date.now() } }
        })
        return key
      },

      removeLine: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),

      setQty: (key, qty) =>
        set((s) => ({
          lines:
            qty <= 0
              ? s.lines.filter((l) => l.key !== key)
              : s.lines.map((l) => (l.key === key ? { ...l, qty: Math.min(qty, 99) } : l)),
        })),

      clear: () => set({ lines: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),

      totalKobo: () => addKobo(...get().lines.map((l) => mulKobo(l.unitKobo, l.qty))),
      totalQty: () => get().lines.reduce((n, l) => n + l.qty, 0),

      toCheckoutEntries: () =>
        get().lines.map((l) => ({
          productId: l.productId,
          name: l.name,
          qty: l.qty,
          selections: l.selections,
          snapshotUnitKobo: l.unitKobo,
        })),
    }),
    {
      name: 'ha-cart-v2',
      version: 2,
      partialize: (s) => ({ lines: s.lines }),
    },
  ),
)
