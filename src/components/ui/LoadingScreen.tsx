import { useEffect, useRef, useState } from 'react'

interface Props {
  /** True once App signals the experience is ready (assets + first frame). */
  ready: boolean
  reducedMotion: boolean
}

/**
 * Premium loading screen with a minimum dwell so the bar never jumps.
 * No drei/three dependency — the page boots without the 3D runtime.
 */
export function LoadingScreen({ ready, reducedMotion }: Props) {
  const [shown, setShown] = useState(0)
  const [gone, setGone] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      setShown((prev) => {
        const target = ready ? 100 : 80
        const step = reducedMotion ? 100 : Math.max(0.4, (target - prev) * 0.06)
        return Math.min(target, prev + step)
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ready, reducedMotion])

  const complete = shown >= 99.5 && ready

  useEffect(() => {
    if (!complete) return
    const el = rootRef.current
    if (!el) return
    if (reducedMotion) {
      setGone(true)
      return
    }
    const t = window.setTimeout(() => setGone(true), 900)
    return () => window.clearTimeout(t)
  }, [complete, reducedMotion])

  if (gone) return null

  return (
    <div
      ref={rootRef}
      role="status"
      aria-label="Loading Hot & Appetizing"
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-obsidian transition-opacity duration-700"
      style={{ opacity: complete ? 0 : 1, pointerEvents: complete ? 'none' : 'auto' }}
    >
      <p className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-cream">
        Hot <span className="text-ember">&amp;</span> Appetizing
      </p>
      <div className="mt-2 flex gap-1.5" aria-hidden="true">
        <span className="loader-dot h-1.5 w-1.5 rounded-full bg-ember" />
        <span className="loader-dot h-1.5 w-1.5 rounded-full bg-ember" />
        <span className="loader-dot h-1.5 w-1.5 rounded-full bg-ember" />
      </div>

      <div className="mt-10 h-px w-56 overflow-hidden bg-charcoal-line">
        <div
          className="h-full bg-gradient-to-r from-ember to-gold transition-none"
          style={{ width: `${shown}%` }}
        />
      </div>
      <p className="mt-3 text-xs tracking-[0.35em] text-ash uppercase">
        {Math.round(shown)}% — kindling the fire
      </p>
    </div>
  )
}
