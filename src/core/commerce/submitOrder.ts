import { getFb, backendConfigured } from '../admin/firebaseClient'
import { checkoutItems, hasServerCheckout, type CheckoutInput, type CheckoutLine } from './checkout'
import { addKobo, mulKobo } from './money'

/**
 * Persist an order record BEFORE the customer is sent to WhatsApp.
 *
 * Honest semantics (Phase 5 §6):
 *  - Only the configured Firebase backend can record orders (server-side
 *    `createOrder` Callable re-validates prices from Firestore and writes the
 *    order atomically; prices are never trusted from the browser).
 *  - If persistence fails, WhatsApp must NOT open and the UI must not claim
 *    success.
 *  - Without a backend there is NO reliable persistence: we return
 *    `persisted: false` with an explicit reason so the UI can tell the
 *    customer the truth (demo mode = WhatsApp draft only, nothing stored).
 *  - The idempotency key becomes the order document's identity server-side,
 *    so an accidental double-submit returns the existing reference instead of
 *    creating a second record.
 */
export interface OrderRecordResult {
  persisted: boolean
  orderRef?: string
  duplicate?: boolean
  reason?: string
}

/**
 * p_idempotency_key must be unique per CUSTOMER SUBMISSION, not just per cart
 * content — two different customers ordering identical items must not
 * collide. Callers pass `checkoutHash + nonce` generated once per drawer
 * session; the function hashes it into the order document id.
 */
export async function recordOrder(
  input: CheckoutInput,
  idempotencyKey: string,
  /** Lines already revalidated against the live catalog (CheckoutDrawer passes these). */
  validatedLines?: CheckoutLine[],
): Promise<OrderRecordResult> {
  if (!backendConfigured()) {
    return {
      persisted: false,
      reason: 'No database backend is connected yet — this order was NOT recorded.',
    }
  }
  const fb = await getFb()
  if (!fb) return { persisted: false, reason: 'Backend unavailable.' }

  const items = checkoutItems(input)
  if (items.length === 0) {
    return { persisted: false, reason: 'Cart is empty or contains no valid items.' }
  }

  if (!hasServerCheckout) return recordRulesOnlyDraft(fb, input, idempotencyKey, validatedLines)

  try {
    const { httpsCallable } = await import('firebase/functions')
    const call = httpsCallable<
      {
        items: { product_id: string; qty: number; option_ids: string[] }[]
        fulfillment: 'pickup' | 'delivery'
        customer_name: string | null
        customer_contact: string | null
        notes: string | null
        idempotency_key: string
      },
      { ok: boolean; order_ref?: string; duplicate?: boolean; issues?: string[] }
    >(fb.fn, 'createOrder')
    const { data: res } = await call({
      items,
      fulfillment: input.fulfillment,
      customer_name: input.customerName.trim() || null,
      customer_contact: input.customerContact.trim() || null,
      notes: input.notes.trim() || null,
      idempotency_key: idempotencyKey.slice(0, 200),
    })
    if (!res?.ok) {
      return {
        persisted: false,
        reason: `Order rejected by the restaurant server: ${(res?.issues ?? ['unknown']).join(' ')}`,
      }
    }
    return { persisted: true, orderRef: res.order_ref, duplicate: res.duplicate }
  } catch (e) {
    return { persisted: false, reason: `Order could not be saved (${e instanceof Error ? e.message : 'network error'}).` }
  }
}

/**
 * Deterministic Firestore-safe document id derived from the idempotency key.
 * Two submits of the same drawer session collide on this id → the second one
 * is reported as a duplicate instead of creating a second record. (Pure
 * double-FNV hash; collision risk is irrelevant here because a false
 * duplicate still returns a valid recorded order and the key embeds a
 * per-session nonce.)
 */
export function rulesOnlyOrderId(key: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0
    h2 = Math.imul((h2 + c) ^ (i + 7), 2246822519) >>> 0
  }
  return `idem_${h2.toString(16).padStart(8, '0')}${h1.toString(16).padStart(8, '0')}`
}

function orderRefNow(): string {
  const n = new Date()
  const p = (x: number) => String(x).padStart(2, '0')
  const rand = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')
  return `HA-${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}-${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}-${rand}`
}

/**
 * Rules-only mode (no Cloud Functions on this plan): the order is written
 * directly to Firestore as an UNVERIFIED 'pending_confirmation' draft.
 * Firestore security rules enforce the shape (draft status only, non-empty
 * items, sane totals) and deny every other write; status changes remain
 * admin-only. Totals come from lines revalidated against the live menu
 * data — never from editable display text — but no independent server
 * recomputes them, so `pricing_verified` is false and the restaurant
 * confirms everything on WhatsApp.
 */
async function recordRulesOnlyDraft(
  fb: Awaited<ReturnType<typeof getFb>>,
  input: CheckoutInput,
  idempotencyKey: string,
  validatedLines?: CheckoutLine[],
): Promise<OrderRecordResult> {
  if (!fb) return { persisted: false, reason: 'Backend unavailable.' }
  const lines: CheckoutLine[] =
    validatedLines && validatedLines.length > 0
      ? validatedLines
      : input.entries.map((e) => ({
          key: e.productId,
          productId: e.productId,
          name: e.name,
          qty: e.qty,
          optionIds: [],
          optionsLabel: '',
          unitKobo: e.snapshotUnitKobo,
          subtotalLabel: '',
        }))

  let subtotal = 0
  for (const l of lines) subtotal = addKobo(subtotal, mulKobo(l.unitKobo, l.qty))

  const now = new Date().toISOString()
  const ref = orderRefNow()
  const orderDoc = {
    ref,
    status: 'pending_confirmation',
    fulfillment: input.fulfillment,
    subtotal_kobo: subtotal,
    delivery_fee_kobo: null,
    customer_name: input.customerName.trim() || null,
    customer_contact: input.customerContact.trim() || null,
    notes: input.notes.trim() || null,
    idempotency_key: idempotencyKey.slice(0, 200),
    pricing_verified: false,
    record_source: 'rules-only-draft',
    items: lines.map((l) => ({
      product_id: l.productId,
      product_name_snapshot: l.name,
      unit_kobo: l.unitKobo,
      qty: l.qty,
      options: l.optionsLabel
        ? l.optionsLabel.split(', ').map((name) => ({ option_name_snapshot: name, price_kobo: 0 }))
        : [],
    })),
    history: [{ from_status: null, to_status: 'pending_confirmation', changed_by: null, changed_at: now }],
  }

  try {
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
    const id = rulesOnlyOrderId(idempotencyKey)
    await setDoc(
      doc(fb.db, 'orders', id),
      { ...orderDoc, created_at: serverTimestamp() },
      { merge: false },
    )
    return { persisted: true, orderRef: ref, duplicate: false }
  } catch (e) {
    const err = e as { code?: string; message?: string }
    if (err?.code === 'already-exists' || /already exists/i.test(err?.message ?? '')) {
      try {
        const { doc, getDoc } = await import('firebase/firestore')
        const existing = await getDoc(doc(fb.db, 'orders', rulesOnlyOrderId(idempotencyKey)))
        return {
          persisted: true,
          orderRef: existing.exists() ? String(existing.data().ref) : ref,
          duplicate: true,
        }
      } catch {
        return { persisted: true, orderRef: ref, duplicate: true }
      }
    }
    return {
      persisted: false,
      reason: `Order could not be saved (${err?.message ?? 'network or permission error'}).`,
    }
  }
}
