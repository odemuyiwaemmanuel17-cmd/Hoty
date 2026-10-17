import type { Product, ProductOption } from '../data/catalogTypes'
import { addKobo, mulKobo } from './money'

/** selections: groupId → chosen option ids */
export type Selections = Record<string, string[]>

export interface ValidationResult {
  valid: boolean
  /** groupId → human-readable error */
  errors: Record<string, string>
}

export function selectedOptionIds(selections: Selections): string[] {
  return Object.values(selections).flat()
}

export function validateConfig(product: Product, options: ProductOption[], selections: Selections): ValidationResult {
  const errors: Record<string, string> = {}
  const byId = new Map(options.map((o) => [o.id, o]))

  for (const group of product.groups ?? []) {
    const chosen = (selections[group.id] ?? []).filter((id) => group.optionIds.includes(id))
    if (group.min > 0 && chosen.length < group.min) {
      errors[group.id] = `${group.name} is required (${group.min} selection${group.min > 1 ? 's' : ''}).`
    }
    if (chosen.length > group.max) {
      errors[group.id] = `${group.name}: choose at most ${group.max}.`
    }
  }

  // cross-option incompatibilities (across all groups)
  const all = selectedOptionIds(selections)
  for (const id of all) {
    const opt = byId.get(id)
    if (!opt) continue
    for (const other of opt.incompatibleWith ?? []) {
      if (all.includes(other) && id < other) {
        const gid = opt.groupId
        if (!errors[gid]) errors[gid] = `${opt.name} and ${byId.get(other)?.name ?? other} cannot be combined.`
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

/** Unit price (kobo) = base + selected option deltas. Throws on unknown option ids. */
export function configUnitKobo(product: Product, options: ProductOption[], selections: Selections): number {
  const byId = new Map(options.map((o) => [o.id, o]))
  const extras = selectedOptionIds(selections).map((id) => {
    const o = byId.get(id)
    if (!o) throw new Error(`unknown option ${id}`)
    return o.priceKobo
  })
  return addKobo(product.priceKobo, ...extras)
}

/** Stable signature: product + sorted option ids. Identical configs merge in cart. */
export function configSignature(productId: string, selections: Selections): string {
  const ids = selectedOptionIds(selections).slice().sort()
  return ids.length ? `${productId}::${ids.join('+')}` : productId
}

export function lineTotalKobo(unitKobo: number, qty: number): number {
  return mulKobo(unitKobo, qty)
}
