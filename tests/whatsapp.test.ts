import { describe, expect, it } from 'vitest'
import { buildCheckoutMessage, whatsappCheckoutUrl } from '../src/core/commerce/whatsapp'
import type { ValidatedCheckout } from '../src/core/commerce/checkout'

const base: ValidatedCheckout = {
  ok: true,
  issues: [],
  orderRef: null,
  lines: [
    { key: 'p1', productId: 'p1', name: 'Build-Your-Own Shawarma', qty: 2, optionIds: ['a', 'b'], optionsLabel: 'Beef, Garlic toum', unitKobo: 290000, subtotalLabel: '₦5,800' },
    { key: 'p2', productId: 'p2', name: 'Classic Chicken Wrap', qty: 1, optionIds: [], optionsLabel: '', unitKobo: 280000, subtotalLabel: '₦2,800' },
  ],
  subtotalKobo: 860000,
  fulfillment: 'pickup',
  deliveryFeeKobo: null,
  hasDemoItems: true,
  customerName: 'Ada',
  customerContact: '0803 000 0000',
  notes: 'mild pepper',
}

describe('WhatsApp checkout message', () => {
  it('includes greeting, items, options, quantities and provisional subtotal', () => {
    const msg = buildCheckoutMessage(base)
    expect(msg).toContain('Hello Hot & Appetizing!')
    expect(msg).toContain('Build-Your-Own Shawarma ×2')
    expect(msg).toContain('(Beef, Garlic toum)')
    expect(msg).toContain('Subtotal (provisional): ₦8,600')
    expect(msg).toContain('Fulfillment: Pickup')
    expect(msg).toContain('Notes: mild pepper')
    expect(msg).toContain('Please confirm availability, final prices and total')
    expect(msg).toContain('DEMO ORDER')
  })

  it('marks delivery fee as pending and never presents a final payable total', () => {
    const msg = buildCheckoutMessage({ ...base, fulfillment: 'delivery' })
    expect(msg).toMatch(/Delivery fee: PENDING CONFIRMATION/i)
    expect(msg).toMatch(/no final payable total/i)
    expect(msg).not.toContain('Total payable')
  })

  it('adds an order reference when one exists', () => {
    const msg = buildCheckoutMessage({ ...base, orderRef: 'HA-20261011-0007' })
    expect(msg).toContain('Order reference: HA-20261011-0007')
  })

  it('builds a correctly encoded click-to-chat URL to the restaurant number', () => {
    const url = whatsappCheckoutUrl(base)
    expect(url.startsWith('https://wa.me/2347077511756?text=')).toBe(true)
    const decoded = decodeURIComponent(url.split('?text=')[1])
    expect(decoded).toBe(buildCheckoutMessage(base))
    // must be single-encoded (no double-encoding of % signs)
    expect(url).not.toContain('%25E2%2580%2594')
    expect(encodeURIComponent('₦8,600')).toBeTruthy()
  })
})
