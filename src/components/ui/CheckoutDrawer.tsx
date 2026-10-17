import { useEffect, useRef, useState } from 'react'
import { useCartStore } from '../../core/stores/useCartStore'
import { useCatalogStore } from '../../core/stores/useCatalogStore'
import {
  validateCheckout,
  isDuplicateCheckout,
  markCheckoutSubmitted,
  hasServerCheckout,
  isRulesOnlyCheckout,
  checkoutHash,
  type CheckoutInput,
  type Fulfillment,
  type ValidatedCheckout,
} from '../../core/commerce/checkout'
import { whatsappCheckoutUrl } from '../../core/commerce/whatsapp'
import { recordOrder } from '../../core/commerce/submitOrder'
import { formatNaira } from '../../core/commerce/money'
import { useReducedMotion } from '../../core/hooks/useReducedMotion'

/**
 * Mobile-first WhatsApp checkout drawer.
 * Revalidates against the catalog (or server RPC when configured) on every
 * change; opening WhatsApp is NOT order confirmation and is never marked as
 * submitted/paid/received. Duplicate checkout attempts are guarded.
 */
export function CheckoutDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const lines = useCartStore((s) => s.lines)
  const setQty = useCartStore((s) => s.setQty)
  const snapshot = useCatalogStore((s) => s.snapshot)
  const reduced = useReducedMotion()

  const [fulfillment, setFulfillment] = useState<Fulfillment>('pickup')
  const [notes, setNotes] = useState('')
  const [customerName, setName] = useState('')
  const [customerContact, setContact] = useState('')
  const [review, setReview] = useState<ValidatedCheckout | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [opened, setOpened] = useState(false)
  const [saving, setSaving] = useState(false)
  const [orderRef, setOrderRef] = useState<string | null>(null)
  const [saveNote, setSaveNote] = useState<string | null>(null)
  // One idempotency key per drawer session: retries dedupe, but a genuine
  // repeat order later is a new submission with a new key.
  const submitKey = useRef<string | null>(null)

  const input: CheckoutInput = {
    entries: useCartStore.getState().toCheckoutEntries(),
    fulfillment,
    customerName,
    customerContact,
    notes,
  }

  useEffect(() => {
    if (!open || !snapshot) return
    let cancelled = false
    setError(null)
    validateCheckout(input, snapshot)
      .then((v) => !cancelled && setReview(v))
      .catch(() => !cancelled && setError('Could not revalidate prices right now. Check your connection and retry.'))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, snapshot, fulfillment, notes, customerName, customerContact, JSON.stringify(lines)])

  // Escape closes checkout (keyboard parity with the ✕ button).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const needsReview = review && review.issues.length > 0
  const canSend = review && review.ok && review.lines.length > 0 && !isDuplicateCheckout(input)

  const send = async () => {
    if (!review || !canSend || saving) return
    setSaving(true)
    setError(null)
    setSaveNote(null)
    let co = review
    if (hasServerCheckout || isRulesOnlyCheckout) {
      // Record the order FIRST; only then open WhatsApp with its reference.
      if (!submitKey.current) {
        submitKey.current = `${checkoutHash(input)}:${(crypto.randomUUID?.() ?? Math.random().toString(36).slice(2))}`
      }
      const res = await recordOrder(input, submitKey.current, review.lines)
      if (!res.persisted) {
        setError(`${res.reason ?? 'The order could not be saved.'} WhatsApp was not opened — please retry.`)
        setSaving(false)
        return
      }
      co = { ...review, orderRef: res.orderRef ?? null }
      setOrderRef(res.orderRef ?? null)
      if (res.duplicate) setSaveNote('This order was already recorded earlier — reopening its draft.')
      else if (isRulesOnlyCheckout)
        setSaveNote(
          'Saved as a draft order — totals come from the live menu but are not re-checked by a payment server. The restaurant confirms availability and the final price on WhatsApp.',
        )
    } else {
      setSaveNote(
        'Demo mode: no database is connected, so this order is NOT stored anywhere — the WhatsApp draft is the only record.',
      )
    }
    markCheckoutSubmitted(input)
    window.open(whatsappCheckoutUrl(co), '_blank', 'noopener')
    setOpened(true)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Checkout">
      <button className="absolute inset-0 bg-obsidian/80 backdrop-blur-sm" aria-label="Close checkout" onClick={onClose} />
      <aside
        className={`absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-ember/40 bg-coal p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-0 sm:top-0 sm:max-h-none sm:w-[26rem] sm:rounded-none sm:rounded-l-2xl sm:border-l ${reduced ? '' : 'animate-[drawer-in_.35s_var(--ease-cinematic)]'}`}
        style={undefined}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-[family-name:var(--font-display)] text-2xl text-cream">Checkout</h3>
          <button onClick={onClose} aria-label="Close checkout" className="min-w-11 min-h-11 -m-2 text-ash hover:text-flame">✕</button>
        </div>
        <p className="mt-1 text-[11px] text-ash">
          {hasServerCheckout
            ? 'Prices validated against the restaurant database.'
            : isRulesOnlyCheckout
              ? 'Prices computed from the live restaurant menu; order saved as a draft for the restaurant to confirm.'
              : 'Demo validation — server pricing not connected yet; totals are provisional.'}
        </p>

        {error && <p role="alert" className="mt-3 rounded border border-ember/40 bg-ember/10 p-3 text-sm text-flame">{error}</p>}

        {needsReview && (
          <div role="alert" className="mt-3 rounded border border-gold/50 bg-gold/10 p-3 text-xs text-gold">
            <p className="font-semibold">Please review these changes before sending:</p>
            <ul className="mt-1 list-disc pl-4">{review!.issues.map((i, n) => <li key={n}>{i}</li>)}</ul>
          </div>
        )}

        <ul className="mt-4 space-y-3">
          {(review?.lines ?? []).map((l) => (
            <li key={l.key} className="flex items-center justify-between gap-3 border-b border-charcoal-line pb-3">
              <div className="flex-1">
                <p className="text-sm text-cream">{l.name} {l.optionsLabel && <span className="text-xs text-ash">({l.optionsLabel})</span>}</p>
                <p className="text-xs text-gold">{l.subtotalLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setQty(l.key, l.qty - 1)} aria-label={`Decrease ${l.name}`} className="min-w-11 min-h-11 rounded-full border border-charcoal-line text-smoke hover:border-ember">−</button>
                <span className="w-5 text-center text-sm text-cream transition-transform">{l.qty}</span>
                <button onClick={() => setQty(l.key, l.qty + 1)} aria-label={`Increase ${l.name}`} className="min-w-11 min-h-11 rounded-full border border-charcoal-line text-smoke hover:border-ember">+</button>
              </div>
            </li>
          ))}
          {review && review.lines.length === 0 && <li className="text-sm text-ash">Nothing valid in the cart.</li>}
        </ul>

        <fieldset className="mt-5">
          <legend className="text-[11px] tracking-[0.3em] uppercase text-ember">Fulfillment</legend>
          <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Fulfillment method">
            {(['pickup', 'delivery'] as const).map((f) => (
              <button
                key={f}
                role="radio"
                aria-checked={fulfillment === f}
                onClick={() => setFulfillment(f)}
                className={`min-h-11 flex-1 rounded-full border px-4 text-xs uppercase tracking-widest ${fulfillment === f ? 'border-ember bg-ember text-obsidian' : 'border-charcoal-line text-smoke hover:border-ember/50'}`}
              >
                {f === 'pickup' ? 'Pickup' : 'Request delivery'}
              </button>
            ))}
          </div>
          {fulfillment === 'delivery' && (
            <p className="mt-2 text-xs text-gold">Delivery fee: pending confirmation — no final payable total is shown until the restaurant quotes it.</p>
          )}
        </fieldset>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-ash">Name (optional)
            <input value={customerName} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-charcoal-line bg-obsidian px-3 py-2.5 text-sm text-cream" />
          </label>
          <label className="text-xs text-ash">Contact (optional)
            <input value={customerContact} onChange={(e) => setContact(e.target.value)} className="mt-1 w-full rounded-lg border border-charcoal-line bg-obsidian px-3 py-2.5 text-sm text-cream" />
          </label>
        </div>
        <label className="mt-3 block text-xs text-ash">Preparation notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-charcoal-line bg-obsidian px-3 py-2.5 text-sm text-cream" placeholder="e.g. extra toum, mild pepper…" />
        </label>

        {review && (
          <div className="mt-4 rounded-xl border border-charcoal-line bg-obsidian/60 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-smoke">Subtotal (provisional)</span>
              <span className="font-semibold text-gold">{formatNaira(review.subtotalKobo)}</span>
            </div>
            {fulfillment === 'delivery' && (
              <div className="mt-1 flex justify-between text-xs">
                <span className="text-ash">Delivery fee</span>
                <span className="text-gold">pending confirmation</span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => void send()}
          disabled={!canSend || saving}
          className="mt-5 w-full rounded-full bg-ember px-6 py-3.5 text-xs font-semibold tracking-[0.25em] uppercase text-obsidian hover:bg-flame disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Recording order…' : 'Continue to WhatsApp'}
        </button>
        {orderRef && (
          <p className="mt-2 text-center text-xs text-gold">
            Order recorded — reference <strong>{orderRef}</strong> (included in your WhatsApp message).
          </p>
        )}
        {saveNote && <p className="mt-2 text-center text-[11px] leading-relaxed text-gold">{saveNote}</p>}
        <p className="mt-2 text-center text-[10px] leading-relaxed text-ash">
          Opening WhatsApp does not confirm the order — your message asks the restaurant to confirm
          availability and final pricing. Nothing here marks the order paid, sent or accepted.
        </p>
        {opened && (
          <p className="mt-2 text-center text-[11px] text-flame">
            WhatsApp opened with your order draft. The order is confirmed only when the restaurant replies.
          </p>
        )}
      </aside>
      <style>{`@keyframes drawer-in { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
    </div>
  )
}
