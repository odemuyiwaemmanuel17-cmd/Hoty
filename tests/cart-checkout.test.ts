import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_OPTIONS, DEMO_PRODUCTS } from '../src/core/data/demoCatalog'
import { fetchCatalog } from '../src/core/data/menuSource'
import type { CatalogSnapshot } from '../src/core/data/catalogTypes'

const customizer = DEMO_PRODUCTS.find((p) => p.id === 'demo-shawarma-custom')!
const unavailable = DEMO_PRODUCTS.find((p) => p.id === 'demo-mixed-jumbo')!
const plain = DEMO_PRODUCTS.find((p) => p.id === 'demo-chicken-wrap')!

async function freshCart() {
  vi.resetModules()
  const mod = await import('../src/core/stores/useCartStore')
  return mod.useCartStore
}

describe('catalog (demo mode)', () => {
  it('loads products with integer kobo prices and demo labelling', async () => {
    const snap = await fetchCatalog()
    expect(snap.source).toBe('demo')
    expect(snap.products.length).toBeGreaterThan(0)
    for (const p of snap.products) {
      expect(Number.isInteger(p.priceKobo)).toBe(true)
      expect(p.demo).toBe(true)
    }
  })
  it('exposes availability state (one unavailable demo product)', async () => {
    const snap = await fetchCatalog()
    expect(snap.products.some((p) => !p.available)).toBe(true)
  })
})

describe('cart engine', () => {
  let store: Awaited<ReturnType<typeof freshCart>>
  beforeEach(async () => {
    localStorage.clear()
    store = await freshCart()
  })

  it('adds configured items and merges identical configurations', () => {
    const sel = { 'grp-filling': ['opt-fill-chicken'], 'grp-size': ['opt-size-regular'] }
    store.getState().addConfigured(customizer, DEMO_OPTIONS, sel)
    store.getState().addConfigured(customizer, DEMO_OPTIONS, sel)
    const lines = store.getState().lines
    expect(lines).toHaveLength(1)
    expect(lines[0].qty).toBe(2)
  })

  it('adds with explicit quantity, merges sums and clamps to 99', () => {
    const sel = { 'grp-filling': ['opt-fill-chicken'], 'grp-size': ['opt-size-regular'] }
    store.getState().addConfigured(customizer, DEMO_OPTIONS, sel, 3)
    expect(store.getState().lines[0].qty).toBe(3)
    store.getState().addConfigured(customizer, DEMO_OPTIONS, sel, 2)
    expect(store.getState().lines[0].qty).toBe(5)
    store.getState().addConfigured(plain, DEMO_OPTIONS, {}, 500)
    expect(store.getState().lines.find((l) => l.productId === plain.id)!.qty).toBe(99)
  })

  it('collapses invalid quantities to 1', () => {
    const beef = DEMO_PRODUCTS.find((p) => p.id === 'demo-beef-wrap')!
    store.getState().addConfigured(beef, DEMO_OPTIONS, {}, 0)
    expect(store.getState().lines[0].qty).toBe(1)
    store.getState().addConfigured(beef, DEMO_OPTIONS, {}, -5)
    expect(store.getState().lines[0].qty).toBe(2)
    store.getState().addConfigured(beef, DEMO_OPTIONS, {}, 1.5)
    expect(store.getState().lines[0].qty).toBe(3)
  })

  it('keeps different configurations separate', () => {
    store.getState().addConfigured(customizer, DEMO_OPTIONS, { 'grp-filling': ['opt-fill-chicken'], 'grp-size': ['opt-size-regular'] })
    store.getState().addConfigured(customizer, DEMO_OPTIONS, { 'grp-filling': ['opt-fill-beef'], 'grp-size': ['opt-size-regular'] })
    expect(store.getState().lines).toHaveLength(2)
  })

  it('adjusts quantities and removes at zero', () => {
    store.getState().addConfigured(plain, DEMO_OPTIONS, {})
    const key = store.getState().lines[0].key
    store.getState().setQty(key, 5)
    expect(store.getState().lines[0].qty).toBe(5)
    store.getState().setQty(key, 0)
    expect(store.getState().lines).toHaveLength(0)
  })

  it('computes integer totals and counts', () => {
    store.getState().addConfigured(plain, DEMO_OPTIONS, {}) // 2800.00
    store.getState().setQty(plain.id, 3)
    expect(store.getState().totalKobo()).toBe(840000)
    expect(store.getState().totalQty()).toBe(3)
  })

  it('clears', () => {
    store.getState().addConfigured(plain, DEMO_OPTIONS, {})
    store.getState().clear()
    expect(store.getState().lines).toHaveLength(0)
  })

  it('persists across reload (browser refresh during cart use)', async () => {
    await new Promise((r) => setTimeout(r, 10)) // let persist hydration settle
    store.getState().addConfigured(customizer, DEMO_OPTIONS, { 'grp-filling': ['opt-fill-beef'], 'grp-size': ['opt-size-large'] })
    await vi.waitFor(() => {
      const raw = localStorage.getItem('ha-cart-v2')
      expect(raw).toBeTruthy()
      expect(JSON.parse(raw!).state.lines).toHaveLength(1)
    })
    const reloaded = await freshCart()
    expect(reloaded.getState().lines[0].name).toBe('Build-Your-Own Shawarma')
    expect(reloaded.getState().lines[0].qty).toBe(1)
  })
})

describe('checkout validation (demo authoritative recomputation)', () => {
  let snap: CatalogSnapshot
  beforeEach(async () => {
    snap = await fetchCatalog()
    vi.resetModules()
  })

  const entry = (qty = 1, sel: Record<string, string[]> = {}, product = plain) => ({
    productId: product.id,
    name: product.name,
    qty,
    selections: sel,
    snapshotUnitKobo: 280000,
  })

  it('valid totals for pickup', async () => {
    const { validateCheckout } = await import('../src/core/commerce/checkout')
    const r = await validateCheckout(
      { entries: [entry(2)], fulfillment: 'pickup', customerName: '', customerContact: '', notes: '' },
      snap,
    )
    expect(r.ok).toBe(true)
    expect(r.subtotalKobo).toBe(560000)
    expect(r.orderRef).toBeNull() // no order record without intentional server action
    expect(r.deliveryFeeKobo).toBeNull()
  })

  it('rejects unavailable products', async () => {
    const { validateCheckout } = await import('../src/core/commerce/checkout')
    const r = await validateCheckout(
      { entries: [{ ...entry(1, {}, unavailable), snapshotUnitKobo: 420000 }], fulfillment: 'pickup', customerName: '', customerContact: '', notes: '' },
      snap,
    )
    expect(r.ok).toBe(false)
    expect(r.issues.join(' ')).toMatch(/unavailable/)
  })

  it('flags price changes for review', async () => {
    const { validateCheckout } = await import('../src/core/commerce/checkout')
    const r = await validateCheckout(
      { entries: [{ ...entry(1), snapshotUnitKobo: 99900 }], fulfillment: 'pickup', customerName: '', customerContact: '', notes: '' },
      snap,
    )
    expect(r.issues.join(' ')).toMatch(/price changed/)
  })

  it('rejects invalid configurations at checkout', async () => {
    const { validateCheckout } = await import('../src/core/commerce/checkout')
    const r = await validateCheckout(
      {
        entries: [{ productId: customizer.id, name: customizer.name, qty: 1, selections: {}, snapshotUnitKobo: 250000 }],
        fulfillment: 'pickup', customerName: '', customerContact: '', notes: '',
      },
      snap,
    )
    expect(r.ok).toBe(false)
    expect(r.issues.join(' ')).toMatch(/required/)
  })

  it('blocks duplicate checkout submissions', async () => {
    const { validateCheckout, isDuplicateCheckout, _resetSubmitted } = await import('../src/core/commerce/checkout')
    _resetSubmitted()
    const input = { entries: [entry(1)], fulfillment: 'pickup' as const, customerName: '', customerContact: '', notes: '' }
    expect(isDuplicateCheckout(input)).toBe(false)
    await validateCheckout(input, snap, { markSubmitted: true })
    expect(isDuplicateCheckout(input)).toBe(true)
  })
})
