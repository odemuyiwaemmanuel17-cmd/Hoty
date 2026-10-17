import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('interaction state machine', () => {
  let store: typeof import('../src/core/stores/useInteractionStore').useInteractionStore

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../src/core/stores/useInteractionStore')
    store = mod.useInteractionStore
  })

  const settle = (p: number) => {
    store.getState().setProgress(p)
    // simulate scroll having settled
    store.setState({ lastScrollAt: 0 })
    store.getState().derive()
  }

  it('idle at hero, exploring in grill/ingredients/collection', () => {
    settle(0)
    expect(store.getState().state).toBe('IDLE')
    settle(0.35)
    expect(store.getState().state).toBe('EXPLORING')
    settle(0.9)
    expect(store.getState().state).toBe('EXPLORING')
  })

  it('menu release maps to MENU_OPEN', () => {
    settle(1)
    expect(store.getState().state).toBe('MENU_OPEN')
  })

  it('cart open overrides everything', () => {
    settle(0.65)
    store.getState().setSelected('x')
    expect(store.getState().state).toBe('PRODUCT_SELECTED')
    store.getState().setCartOpen(true)
    expect(store.getState().state).toBe('CART_OPEN')
    store.getState().setCartOpen(false)
    expect(store.getState().state).toBe('PRODUCT_SELECTED')
  })

  it('transitioning immediately after a scroll update', () => {
    store.getState().setProgress(0.3)
    expect(store.getState().state).toBe('TRANSITIONING')
  })
})
