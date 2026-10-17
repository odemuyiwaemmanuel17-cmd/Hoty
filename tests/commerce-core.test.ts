import { describe, expect, it } from 'vitest'
import { addKobo, formatNaira, mulKobo } from '../src/core/commerce/money'
import {
  configSignature,
  configUnitKobo,
  validateConfig,
} from '../src/core/commerce/configurator'
import { DEMO_OPTIONS, DEMO_PRODUCTS } from '../src/core/data/demoCatalog'

const product = DEMO_PRODUCTS.find((p) => p.id === 'demo-shawarma-custom')!

describe('integer money', () => {
  it('formats kobo as naira', () => {
    expect(formatNaira(250000)).toBe('₦2,500')
    expect(formatNaira(250050)).toBe('₦2,500.50')
    expect(formatNaira(0)).toBe('₦0')
  })
  it('rejects non-integer kobo', () => {
    expect(() => addKobo(100, 1.5)).toThrow()
    expect(() => mulKobo(100.5, 2)).toThrow()
  })
  it('multiplies exactly', () => {
    expect(mulKobo(330000, 3)).toBe(990000)
  })
})

describe('configuration validation', () => {
  it('requires min-selections groups', () => {
    const v = validateConfig(product, DEMO_OPTIONS, {})
    expect(v.valid).toBe(false)
    expect(v.errors['grp-filling']).toMatch(/required/)
    expect(v.errors['grp-size']).toMatch(/required/)
  })
  it('accepts a valid configuration', () => {
    const sel = { 'grp-filling': ['opt-fill-chicken'], 'grp-size': ['opt-size-regular'] }
    expect(validateConfig(product, DEMO_OPTIONS, sel).valid).toBe(true)
  })
  it('enforces max selections', () => {
    const sel = {
      'grp-filling': ['opt-fill-chicken'],
      'grp-size': ['opt-size-regular'],
      'grp-sauce': ['opt-sauce-garlic', 'opt-sauce-hot', 'opt-sauce-tahini'],
    }
    const v = validateConfig(product, DEMO_OPTIONS, sel)
    expect(v.valid).toBe(false)
    expect(v.errors['grp-sauce']).toMatch(/at most 2/)
  })
  it('rejects incompatible combinations', () => {
    const sel = {
      'grp-filling': ['opt-fill-chicken'],
      'grp-size': ['opt-size-regular'],
      'grp-sauce': ['opt-sauce-hot', 'opt-sauce-tahini'],
    }
    const v = validateConfig(product, DEMO_OPTIONS, sel)
    expect(v.valid).toBe(false)
    expect(Object.values(v.errors).join(' ')).toMatch(/cannot be combined/)
  })
  it('computes unit price from server-side option deltas', () => {
    const sel = {
      'grp-filling': ['opt-fill-mixed'],
      'grp-size': ['opt-size-large'],
      'grp-extra': ['opt-extra-cheese'],
    }
    // base 2500.00 + mixed 500 + large 800 + cheese 300 = 4100.00
    expect(configUnitKobo(product, DEMO_OPTIONS, sel)).toBe(410000)
  })
  it('throws on unknown option ids (never invents prices)', () => {
    expect(() => configUnitKobo(product, DEMO_OPTIONS, { 'grp-filling': ['nope'] })).toThrow()
  })
  it('signatures are stable and order-insensitive', () => {
    const a = configSignature('p1', { g1: ['x', 'y'], g2: ['z'] })
    const b = configSignature('p1', { g2: ['z'], g1: ['y', 'x'] })
    expect(a).toBe(b)
    expect(a).toBe('p1::x+y+z')
    expect(configSignature('p1', {})).toBe('p1')
  })
})
