import { useEffect, useRef } from 'react'
import { BUSINESS } from '../../core/business'
import { scrollToSection } from '../../core/hooks/useHeroScroll'
import { scrollSignal } from '../../core/stores/useSceneStore'
import { handoffOpacity } from '../../core/hybrid/hybridStory'
import { useReducedMotion } from '../../core/hooks/useReducedMotion'

/**
 * The finished-meal → menu handoff. Fades in over the last stretch of the
 * single scroll timeline and offers real actions (menu route + WhatsApp).
 * DOM writes from scrollSignal inside rAF — no React state per scroll, and
 * the loop idles (cheap early-exit) outside the handoff window.
 */
export function StoryHandoff() {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduced) return
    const el = ref.current
    if (!el) return
    let raf = 0
    let last = -1
    let lastPE = false
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const o = handoffOpacity(scrollSignal.progress)
      const q = Math.round(o * 20) / 20
      if (q !== last) {
        last = q
        el.style.opacity = String(q)
        el.setAttribute('aria-hidden', q < 0.05 ? 'true' : 'false')
      }
      const pe = q > 0.6
      if (pe !== lastPE) {
        lastPE = pe
        el.style.pointerEvents = pe ? 'auto' : 'none'
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [reduced])

  if (reduced) return null // reduced-motion visitors reach the menu via hero CTAs / navbar

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col items-center gap-4 px-6 pb-16 pt-24 text-center"
      style={{ opacity: 0 }}
      aria-hidden="true"
    >
      <p className="text-[length:var(--text-eyebrow)] tracking-[0.4em] uppercase text-gold">
        Ready when you are
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          onClick={() => scrollToSection('menu', false)}
          className="rounded-full bg-ember px-8 py-3.5 text-xs font-semibold tracking-[0.25em] uppercase text-obsidian shadow-glow transition-all hover:bg-flame"
        >
          Explore Menu
        </button>
        <a
          href={`https://wa.me/${BUSINESS.whatsapp}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-cream/30 px-8 py-3.5 text-xs font-semibold tracking-[0.25em] uppercase text-cream backdrop-blur-sm transition-colors hover:border-ember hover:text-flame"
        >
          Order on WhatsApp
        </a>
      </div>
    </div>
  )
}
