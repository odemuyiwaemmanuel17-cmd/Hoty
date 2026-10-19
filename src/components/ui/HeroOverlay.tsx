import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { BUSINESS } from '../../core/business'
import { scrollToExperience, scrollToSection } from '../../core/hooks/useHeroScroll'
import { scrollSignal } from '../../core/stores/useSceneStore'
import { videoOpacity } from '../../core/hybrid/hybridStory'

interface Props {
  cinematic: boolean
}

export function HeroOverlay({ cinematic }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const reduced = !cinematic

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    if (reduced) {
      gsap.set(el.querySelectorAll('[data-reveal]'), { opacity: 1, y: 0 })
      return
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-reveal]',
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: 1.1,
          stagger: 0.16,
          ease: 'power3.out',
          delay: 0.15,
        },
      )
    }, el)
    return () => ctx.revert()
  }, [reduced])

  // Overlay fades out exactly as the opening video hands over to the frame
  // scrub — driven from scrollSignal in rAF (DOM writes only, no React state).
  useEffect(() => {
    if (reduced) return
    const el = rootRef.current
    if (!el) return
    let raf = 0
    let last = -1
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const fade = Math.max(0, videoOpacity(scrollSignal.progress))
      const q = Math.round(fade * 50) / 50
      if (q !== last) {
        last = q
        el.style.opacity = String(q)
        el.setAttribute('aria-hidden', q < 0.05 ? 'true' : 'false')
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [reduced])

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end px-5 pb-24 sm:px-10 lg:pb-28"
      style={{ opacity: 1 }}
      aria-hidden={reduced ? undefined : true}
    >
      <div className="max-w-3xl">
        <p data-reveal className="text-[length:var(--text-eyebrow)] tracking-[0.45em] uppercase text-ember">
          {BUSINESS.category} · Alimosho, Lagos
        </p>
        <h1
          data-reveal
          className="mt-4 text-balance font-[family-name:var(--font-display)] text-[length:var(--text-hero)] leading-[0.95] font-semibold text-cream"
        >
          Hot <span className="text-ember italic">&amp;</span> Appetizing
        </h1>
        <p data-reveal className="mt-4 max-w-xl text-sm leading-relaxed text-smoke sm:text-base">
          Fresh off the grill. Made to satisfy — scroll to steer the film from
          fire to finished wrap.
        </p>
        <div data-reveal className="pointer-events-auto mt-8 flex flex-wrap items-center gap-4">
          <button
            onClick={() => scrollToExperience(reduced)}
            className="rounded-full bg-ember px-7 py-3 text-xs font-semibold tracking-[0.25em] uppercase text-obsidian transition-all hover:bg-flame hover:shadow-glow"
          >
            Explore the Experience
          </button>
          <button
            onClick={() => scrollToSection('menu', reduced)}
            className="rounded-full border border-cream/25 px-7 py-3 text-xs font-semibold tracking-[0.25em] uppercase text-cream transition-colors hover:border-ember hover:text-flame"
          >
            View Our Menu
          </button>
          <a
            href={`https://wa.me/${BUSINESS.whatsapp}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full px-3 py-3 text-xs font-semibold tracking-[0.25em] uppercase text-ash transition-colors hover:text-flame"
          >
            Order on WhatsApp
          </a>
        </div>
      </div>

      {/* Reference-short ingredient callouts: labels pinned around the hero subject
          (root element already carries the scroll fade). Text shadow keeps them
          legible over bright film beats (e.g. the white-background sauce splash). */}
      {cinematic && (
        <div className="absolute inset-0" aria-hidden="true">
          <div data-reveal className="absolute left-[5%] top-[16%] flex items-center gap-2 sm:left-[10%]">
            <span className="h-1.5 w-1.5 rounded-full bg-ember shadow-glow" />
            <span className="h-px w-8 bg-gradient-to-r from-ember/80 to-transparent sm:w-14" />
            <span className="text-[9px] uppercase tracking-[0.3em] text-cream/90 [text-shadow:0_1px_10px_rgba(10,8,7,0.95),0_0_2px_rgba(10,8,7,0.8)] sm:text-[10px]">Char-grilled shawarma</span>
          </div>
          <div data-reveal className="absolute right-[5%] top-[30%] flex items-center gap-2 sm:right-[10%] flex-row-reverse">
            <span className="h-1.5 w-1.5 rounded-full bg-gold shadow-glow" />
            <span className="h-px w-8 bg-gradient-to-l from-gold/80 to-transparent sm:w-14" />
            <span className="text-[9px] uppercase tracking-[0.3em] text-cream/90 [text-shadow:0_1px_10px_rgba(10,8,7,0.95),0_0_2px_rgba(10,8,7,0.8)] sm:text-[10px]">Fresh tomato &amp; lettuce</span>
          </div>
          <div data-reveal className="absolute left-[4%] top-[42%] hidden items-center gap-2 sm:flex sm:left-[8%]">
            <span className="h-1.5 w-1.5 rounded-full bg-cream/80" />
            <span className="h-px w-10 bg-gradient-to-r from-cream/50 to-transparent" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-cream/90 [text-shadow:0_1px_10px_rgba(10,8,7,0.95),0_0_2px_rgba(10,8,7,0.8)]">Spiced &amp; carved to order</span>
          </div>
        </div>
      )}

      {cinematic && (
        <div
          className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 sm:flex"
          aria-hidden="true"
        >
          <span className="text-[10px] tracking-[0.4em] uppercase text-ash">Scroll</span>
          <span className="h-10 w-px bg-gradient-to-b from-ember to-transparent" />
        </div>
      )}

      {/* screen-reader summary of the visual journey */}
      <span className="sr-only">
        Scroll to watch the shawarma come together — from the rotating grill,
        through the fresh ingredients, to the finished wrap.
      </span>
    </div>
  )
}
