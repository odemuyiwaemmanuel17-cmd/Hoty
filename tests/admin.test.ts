import { describe, it, expect } from 'vitest'
import {
  canTransition,
  nextStatuses,
  isOrderStatus,
  ORDER_STATUSES,
} from '../src/core/admin/orderStatus'
import { checkoutItems, checkoutHash, type CheckoutInput } from '../src/core/commerce/checkout'
import { recordOrder, rulesOnlyOrderId } from '../src/core/commerce/submitOrder'
import { validateDraft } from '../src/core/admin/api'

describe('order status transitions (mirror of 0002_admin.sql can_transition)', () => {
  it('allows the happy path and cancels from non-terminal states', () => {
    expect(canTransition('pending_confirmation', 'confirmed')).toBe(true)
    expect(canTransition('confirmed', 'preparing')).toBe(true)
    expect(canTransition('preparing', 'ready')).toBe(true)
    expect(canTransition('ready', 'completed')).toBe(true)
    for (const s of ['pending_confirmation', 'confirmed', 'preparing', 'ready'] as const) {
      expect(canTransition(s, 'cancelled')).toBe(true)
    }
  })

  it('rejects skips, backwards moves and terminal-state changes', () => {
    expect(canTransition('pending_confirmation', 'preparing')).toBe(false)
    expect(canTransition('pending_confirmation', 'completed')).toBe(false)
    expect(canTransition('completed', 'preparing')).toBe(false)
    expect(canTransition('cancelled', 'confirmed')).toBe(false)
    expect(canTransition('completed', 'cancelled')).toBe(false)
    expect(nextStatuses('completed')).toHaveLength(0)
    expect(nextStatuses('cancelled')).toHaveLength(0)
  })

  it('is defensive against garbage input', () => {
    expect(canTransition('nonsense', 'confirmed')).toBe(false)
    expect(canTransition(null, 'confirmed')).toBe(false)
    expect(isOrderStatus('ready')).toBe(true)
    expect(isOrderStatus('dropped')).toBe(false)
    expect(ORDER_STATUSES).toHaveLength(6)
  })
})

describe('checkout → server item mapping', () => {
  const input: CheckoutInput = {
    entries: [
      { productId: 'p1', name: 'Wrap', qty: 2, selections: { g1: ['o1'] }, snapshotUnitKobo: 300000 },
    ],
    fulfillment: 'pickup',
    customerName: 'Ada',
    customerContact: '',
    notes: '',
  }

  it('maps entries to product_id/qty/option_ids', () => {
    expect(checkoutItems(input)).toEqual([
      { product_id: 'p1', qty: 2, option_ids: ['o1'] },
    ])
  })

  it('produces a stable idempotency hash for identical carts (cart contents only)', () => {
    expect(checkoutHash(input)).toBe(checkoutHash({ ...input }))
    expect(checkoutHash(input)).toBe(checkoutHash({ ...input, customerName: 'Someone else' }))
    expect(checkoutHash(input)).not.toBe(
      checkoutHash({ ...input, entries: [{ ...input.entries[0], qty: 3 }] }),
    )
  })
})

describe('order recording honesty (no backend configured in tests)', () => {
  it('never reports a persisted order without a database', async () => {
    const res = await recordOrder(
      {
        entries: [{ productId: 'p1', name: 'Wrap', qty: 1, selections: {}, snapshotUnitKobo: 100 }],
        fulfillment: 'pickup',
        customerName: '',
        customerContact: '',
        notes: '',
      },
      'hash:nonce',
    )
    expect(res.persisted).toBe(false)
    expect(res.orderRef).toBeUndefined()
    expect(res.reason).toMatch(/NOT recorded/i)
  })

  it('refuses to record an empty cart', async () => {
    const res = await recordOrder(
      { entries: [], fulfillment: 'pickup', customerName: '', customerContact: '', notes: '' },
      'hash:nonce',
    )
    expect(res.persisted).toBe(false)
  })
})

describe('rules-only order drafts (no Cloud Functions on the free plan)', () => {
  it('derives a deterministic Firestore-safe document id from the idempotency key', () => {
    const a = rulesOnlyOrderId('hash:nonce-123')
    expect(a).toBe(rulesOnlyOrderId('hash:nonce-123'))
    expect(a).toMatch(/^idem_[0-9a-f]{16}$/) // matches the create rule id.matches(...)
    expect(a).not.toBe(rulesOnlyOrderId('hash:nonce-456'))
  })
})

describe('admin product validation', () => {
  const base = {
    description: null, available: true, archived: false, image_url: null, category_id: null,
  }
  it('requires a name', () => {
    expect(validateDraft({ ...base, name: '  ', price_kobo: 1000 })).toMatch(/required/i)
  })
  it('requires a whole-naira price in range', () => {
    expect(validateDraft({ ...base, name: 'X', price_kobo: 0 })).toMatch(/whole-naira/i)
    expect(validateDraft({ ...base, name: 'X', price_kobo: 10.5 })).toMatch(/whole-naira/i)
    expect(validateDraft({ ...base, name: 'X', price_kobo: 1_000_000_000 })).toMatch(/whole-naira/i)
    expect(validateDraft({ ...base, name: 'X', price_kobo: 250_000 })).toBeNull()
  })
})
