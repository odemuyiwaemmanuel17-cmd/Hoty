import type { CatalogSnapshot, Product } from '../data/catalogTypes'
import { configSignature, configUnitKobo, selectedOptionIds, validateConfig, type Selections } from './configurator'
import { addKobo, mulKobo } from './money'
import { backend } from '../config/env'

/**
 * Checkout validation. With Firebase configured this calls the server
 * Callable `validateCheckout` (authoritative prices from Firestore); in demo
 * mode it recomputes against the current in-memory catalog — the same
 * contract, non-authoritative.
 */

export interface CheckoutLine {
  /** cart line signature (productId + sorted option ids) */
  key: string
  productId: string
  name: string
  qty: number
  optionIds: string[]
  optionsLabel: string
  unitKobo: number
  subtotalLabel: string
}

export type Fulfillment = 'pickup' | 'delivery'

/** Line shape returned by the server `validateCheckout`/`createOrder` callables. */
interface ServerLine {
  key: string
  product_id: string
  name: string
  qty: number
  option_ids?: string[]
  option_names?: string[]
  unit_kobo: number
  subtotal_kobo: number
}

export interface ValidatedCheckout {
  ok: boolean
  /** Errors per line key (unavailable product, price changed, invalid config). */
  issues: string[]
  orderRef: string | null
  lines: CheckoutLine[]
  subtotalKobo: number
  fulfillment: Fulfillment
  /** Delivery fee is never assumed — pending until restaurant configures it. */
  deliveryFeeKobo: number | null
  hasDemoItems: boolean
  customerName: string
  customerContact: string
  notes: string
}

export interface CartEntry {
  productId: string
  name: string
  qty: number
  selections: Selections
  /** Price snapshot taken when the item entered the cart. */
  snapshotUnitKobo: number
}

export interface CheckoutInput {
  entries: CartEntry[]
  fulfillment: Fulfillment
  customerName: string
  customerContact: string
  notes: string
}

/** Server-authoritative validation is only possible with Cloud Functions (Blaze). */
export const hasServerCheckout = backend.configured && backend.mode === 'functions'
/** Configured backend without Functions: live-menu validation, draft orders. */
export const isRulesOnlyCheckout = backend.configured && backend.mode === 'rules-only'

/** Idempotency guard: a checkout hash can only be submitted once per session. */
const submittedHashes = new Set<string>()

export function checkoutHash(input: CheckoutInput): string {
  return JSON.stringify(
    input.entries
      .map((e) => [e.productId, configSignature(e.productId, e.selections), e.qty])
      .sort(),
  )
}

/** Map cart entries to the server RPC item shape (ids + qty + chosen options). */
export function checkoutItems(input: CheckoutInput): { product_id: string; qty: number; option_ids: string[] }[] {
  return input.entries.map((e) => ({
    product_id: e.productId,
    qty: e.qty,
    option_ids: selectedOptionIds(e.selections),
  }))
}

export async function validateCheckout(
  input: CheckoutInput,
  catalog: CatalogSnapshot,
  opts: { markSubmitted?: boolean } = {},
): Promise<ValidatedCheckout> {
  if (hasServerCheckout) {
    // Server-authoritative validation via the `validateCheckout` Callable.
    // Firebase SDK is imported lazily so the cinematic homepage never loads it.
    const { getFb } = await import('../admin/firebaseClient')
    const { httpsCallable } = await import('firebase/functions')
    const fb = await getFb()
    if (!fb) throw new Error('Backend unavailable.')
    const call = httpsCallable<
      { items: { product_id: string; qty: number; option_ids: string[] }[]; fulfillment: Fulfillment },
      {
        ok: boolean
        order_ref: string | null
        issues: string[]
        lines: ServerLine[]
        subtotal_kobo: number
        delivery_fee_kobo: number | null
      }
    >(fb.fn, 'validateCheckout')
    const res = await call({ items: checkoutItems(input), fulfillment: input.fulfillment })
    const data = res.data
    const lines: CheckoutLine[] = (data.lines ?? []).map((l) => ({
      key: l.key,
      productId: l.product_id,
      name: l.name,
      qty: l.qty,
      optionIds: l.option_ids ?? [],
      optionsLabel: (l.option_names ?? []).join(', '),
      unitKobo: l.unit_kobo,
      subtotalLabel: `₦${(l.subtotal_kobo / 100).toLocaleString('en-NG')}`,
    }))
    return {
      ok: data.ok,
      issues: data.issues ?? [],
      lines,
      orderRef: data.order_ref ?? null,
      subtotalKobo: data.subtotal_kobo,
      deliveryFeeKobo: data.delivery_fee_kobo ?? null,
      hasDemoItems: false,
      fulfillment: input.fulfillment,
      customerName: input.customerName,
      customerContact: input.customerContact,
      notes: input.notes,
    }
  }

  // ---- demo validation against the current catalog (same shape as server) ----
  const products = new Map(catalog.products.map((p) => [p.id, p]))
  const options = catalog.options
  const optById = new Map(options.map((o) => [o.id, o]))
  const issues: string[] = []
  const lines: CheckoutLine[] = []
  let subtotal = 0
  let hasDemo = false

  for (const e of input.entries) {
    const product: Product | undefined = products.get(e.productId)
    if (!product) {
      issues.push(`${e.name}: no longer on the menu.`)
      continue
    }
    if (!product.available) {
      issues.push(`${product.name} is currently unavailable.`)
      continue
    }
    if (product.groups?.length) {
      const v = validateConfig(product, options, e.selections)
      if (!v.valid) {
        issues.push(`${product.name}: ${Object.values(v.errors).join(' ')}`)
        continue
      }
    }
    const unit = configUnitKobo(product, options, e.selections)
    if (unit !== e.snapshotUnitKobo) {
      issues.push(`${product.name}: price changed from ${e.snapshotUnitKobo / 100} to ${unit / 100} — please review.`)
    }
    const optionsLabel = selectedOptionIds(e.selections)
      .map((id) => optById.get(id)?.name ?? id)
      .join(', ')
    lines.push({
      key: configSignature(e.productId, e.selections),
      productId: product.id,
      name: product.name,
      qty: e.qty,
      optionIds: selectedOptionIds(e.selections),
      optionsLabel,
      unitKobo: unit,
      subtotalLabel: `₦${(mulKobo(unit, e.qty) / 100).toLocaleString('en-NG')}`,
    })
    subtotal = addKobo(subtotal, mulKobo(unit, e.qty))
    hasDemo = hasDemo || product.demo
  }

  if (opts.markSubmitted) submittedHashes.add(checkoutHash(input))

  return {
    ok: issues.length === 0,
    issues,
    orderRef: null, // order records are only created by an intentional server-side action
    lines,
    subtotalKobo: subtotal,
    fulfillment: input.fulfillment,
    deliveryFeeKobo: null, // never configured client-side
    hasDemoItems: hasDemo,
    customerName: input.customerName,
    customerContact: input.customerContact,
    notes: input.notes,
  }
}

export function isDuplicateCheckout(input: CheckoutInput): boolean {
  return submittedHashes.has(checkoutHash(input))
}

/** Arm the duplicate guard for an already-submitted checkout (UI send action). */
export function markCheckoutSubmitted(input: CheckoutInput) {
  submittedHashes.add(checkoutHash(input))
}

/** test seam */
export function _resetSubmitted() {
  submittedHashes.clear()
}
