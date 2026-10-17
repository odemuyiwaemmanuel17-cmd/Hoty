import { useEffect, useRef, useState } from 'react'
import { BUSINESS } from '../../core/business'
import { useCartStore } from '../../core/stores/useCartStore'
import { formatNaira, mulKobo } from '../../core/commerce/money'
import { CheckoutDrawer } from './CheckoutDrawer'
import { useReducedMotion } from '../../core/hooks/useReducedMotion'
import { scrollToSection } from '../../core/hooks/useHeroScroll'

export function CartButton() {
  const lines = useCartStore((s) => s.lines)
  const open = useCartStore((s) => s.open)
  const lastAdded = useCartStore((s) => s.lastAdded)
  const reduced = useReducedMotion()
  const [pop, setPop] = useState(false)
  const prevAt = useRef(0)

  useEffect(() => {
    if (lastAdded && lastAdded.at !== prevAt.current && !reduced) {
      prevAt.current = lastAdded.at
      setPop(true)
      const t = window.setTimeout(() => setPop(false), 450)
      return () => window.clearTimeout(t)
    }
  }, [lastAdded, reduced])

  const count = lines.reduce((n, l) => n + l.qty, 0)

  return (
    <button
      onClick={open}
      aria-label={`Open order tray, ${count} item${count === 1 ? '' : 's'}`}
      className={`fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-ember text-obsidian shadow-glow transition-transform hover:scale-105 active:scale-95 ${pop ? 'scale-125' : ''}`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 8h14l-1.2 11a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Zm3 0a4 4 0 1 1 8 0" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full border border-obsidian bg-obsidian px-1 text-xs font-bold text-flame">
          {count}
        </span>
      )}
    </button>
  )
}

export function CartPanel() {
  const { lines, isOpen, close, setQty, removeLine, clear, totalKobo } = useCartStore()
  const [checkout, setCheckout] = useState(false)
  const reduced = useReducedMotion()

  // Escape closes the tray (keyboard parity with the ✕ button).
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, close])

  const browseMenu = () => {
    close()
    scrollToSection('menu', reduced)
  }

  if (!isOpen) return (
    <CheckoutDrawer open={checkout} onClose={() => setCheckout(false)} />
  )

  return (
    <>
      <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Order tray">
        <button className="absolute inset-0 bg-obsidian/70 backdrop-blur-sm" aria-label="Close tray" onClick={close} />
        <aside className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-ember/30 bg-coal p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-glow sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-96 sm:rounded-none sm:rounded-l-2xl sm:border-l">
          <div className="flex items-center justify-between">
            <h3 className="font-[family-name:var(--font-display)] text-2xl text-cream">Your tray</h3>
            <button onClick={close} aria-label="Close order tray" className="min-w-11 min-h-11 -m-2 text-ash hover:text-flame">✕</button>
          </div>

          {lines.length === 0 ? (
            <div className="mt-8">
              <p className="text-sm text-ash">
                Nothing searing yet. Add items from the menu, or order directly via{' '}
                <a className="text-ember underline" href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a>.
              </p>
              <button
                onClick={browseMenu}
                className="mt-5 w-full rounded-full border border-ember/60 px-6 py-3 text-xs font-semibold tracking-[0.25em] uppercase text-ember hover:bg-ember hover:text-obsidian"
              >
                Browse the menu
              </button>
            </div>
          ) : (
            <>
              <ul className="mt-6 space-y-4">
                {lines.map((l) => (
                  <li key={l.key} className="flex items-start justify-between gap-3 border-b border-charcoal-line pb-4">
                    <div className="flex-1">
                      <p className="text-sm text-cream">{l.name}</p>
                      {l.optionsLabel && <p className="mt-0.5 text-xs text-ash">{l.optionsLabel}</p>}
                      <p className="mt-1 text-xs text-gold">{formatNaira(mulKobo(l.unitKobo, l.qty))}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQty(l.key, l.qty - 1)} aria-label={`Decrease ${l.name}`} className="min-w-11 h-7 rounded-full border border-charcoal-line text-smoke hover:border-ember hover:text-flame">−</button>
                      <span className="w-6 text-center text-sm text-cream">{l.qty}</span>
                      <button onClick={() => setQty(l.key, l.qty + 1)} aria-label={`Increase ${l.name}`} className="min-w-11 h-7 rounded-full border border-charcoal-line text-smoke hover:border-ember hover:text-flame">+</button>
                      <button onClick={() => removeLine(l.key)} aria-label={`Remove ${l.name}`} className="ml-1 text-xs text-ash hover:text-flame">remove</button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-charcoal-line bg-obsidian/60 p-4">
                <span className="text-sm text-smoke">Subtotal (provisional)</span>
                <span className="font-semibold text-gold">{formatNaira(totalKobo())}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ash">
                Totals are provisional until revalidated at checkout against current prices.
              </p>

              <div className="mt-5 flex flex-col gap-3">
                <button
                  onClick={() => { close(); setCheckout(true) }}
                  className="rounded-full bg-ember px-6 py-3 text-xs font-semibold tracking-[0.25em] uppercase text-obsidian hover:bg-flame hover:shadow-glow"
                >
                  Continue to checkout
                </button>
                <button
                  onClick={browseMenu}
                  className="rounded-full border border-ember/60 px-6 py-3 text-xs font-semibold tracking-[0.25em] uppercase text-ember hover:bg-ember hover:text-obsidian"
                >
                  Add more from the menu
                </button>
                <button onClick={close} className="text-xs tracking-widest uppercase text-ash hover:text-flame">Continue shopping</button>
                <button onClick={clear} className="text-xs tracking-widest uppercase text-ash hover:text-flame">Clear tray</button>
              </div>
            </>
          )}
        </aside>
      </div>
      <CheckoutDrawer open={checkout} onClose={() => setCheckout(false)} />
    </>
  )
}
