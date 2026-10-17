import { useEffect, useState } from 'react'
import { BUSINESS } from '../../core/business'
import { scrollToSection } from '../../core/hooks/useHeroScroll'
import { useReducedMotion } from '../../core/hooks/useReducedMotion'

const LINKS = [
  { label: 'Experience', id: 'hero' },
  { label: 'Menu', id: 'menu' },
  { label: 'Visit', id: 'visit' },
] as const

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const go = (id: string) => {
    setOpen(false)
    scrollToSection(id, reduced)
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
        scrolled ? 'bg-obsidian/85 backdrop-blur-md border-b border-charcoal-line' : 'bg-transparent'
      }`}
    >
      <nav aria-label="Primary" className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <a
          href="#hero"
          onClick={(e) => { e.preventDefault(); go('hero') }}
          className="font-[family-name:var(--font-display)] text-lg tracking-wide text-cream"
        >
          Hot <span className="text-ember">&amp;</span> Appetizing
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <button
              key={l.id}
              onClick={() => go(l.id)}
              className="text-xs tracking-[0.25em] uppercase text-smoke transition-colors hover:text-flame"
            >
              {l.label}
            </button>
          ))}
          <a
            href={`tel:${BUSINESS.phoneE164}`}
            className="rounded-full border border-ember/60 px-4 py-1.5 text-xs tracking-[0.2em] uppercase text-ember transition-all hover:bg-ember hover:text-obsidian hover:shadow-glow"
          >
            Call to order
          </a>
        </div>

        <button
          className="md:hidden p-2 text-cream"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open navigation'}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            {open ? (
              <path d="M4 4l14 14M18 4L4 18" stroke="currentColor" strokeWidth="1.5" />
            ) : (
              <path d="M2 6h18M2 11h18M2 16h12" stroke="currentColor" strokeWidth="1.5" />
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-b border-charcoal-line bg-obsidian/95 px-5 pb-5 backdrop-blur-md md:hidden">
          {LINKS.map((l) => (
            <button
              key={l.id}
              onClick={() => go(l.id)}
              className="block w-full py-3 text-left text-sm tracking-[0.25em] uppercase text-smoke hover:text-flame"
            >
              {l.label}
            </button>
          ))}
          <a
            href={`tel:${BUSINESS.phoneE164}`}
            className="mt-2 block rounded-full border border-ember/60 px-4 py-2.5 text-center text-xs tracking-[0.2em] uppercase text-ember"
          >
            Call {BUSINESS.phoneDisplay}
          </a>
        </div>
      )}
    </header>
  )
}
