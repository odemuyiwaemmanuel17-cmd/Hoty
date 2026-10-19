import { useEffect, useRef } from 'react'
import { scrollSignal } from '../../core/stores/useSceneStore'
import { useReducedMotion } from '../../core/hooks/useReducedMotion'
import {
  VIDEO_URL,
  POSTER_URL,
  STAGE_POSTER_URL,
  frameUrl,
  CROSSFADE_END,
  SCRUB_LAST_FRAME,
  videoOpacity,
  canvasOpacity,
  frameIndexFromProgress,
} from '../../core/hybrid/hybridStory'

const CACHE_LIMIT = 64

/**
 * Dominant background of the existing food section (#scroll-space): the
 * opening MP4 plays normally, then crossfades — driven by the ONE master
 * scroll timeline (scrollSignal) — into a canvas scrubbing 270 sequential
 * frames of the same film. No own ScrollTrigger, no React state per scroll:
 * a single requestAnimationFrame loop reads the master progress and repaints
 * only when the frame index or a layer opacity actually changes. Paused
 * whenever the section is offscreen or the tab is hidden.
 */
export function FoodScrollStage() {
  const reduced = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduced) return // static poster path — nothing animates
    const root = rootRef.current
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!root || !canvas || !video) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cache = new Map<number, HTMLImageElement>()
    const ready = (img?: HTMLImageElement) => !!img && img.complete && img.naturalWidth > 0
    let current = 0
    let lastP = -1
    let dirty = true

    const ensure = (i: number) => {
      if (i < 0 || i > SCRUB_LAST_FRAME || cache.has(i)) return
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => {
        if (Math.abs(i - current) <= 8) dirty = true
      }
      img.src = frameUrl(i)
      // Pre-decode off the critical path; a failed decode still falls back
      // to paint-time decoding via the onload/complete checks.
      if (typeof img.decode === 'function') img.decode().catch(() => {})
      cache.set(i, img)
    }

    const trim = (i: number) => {
      if (cache.size <= CACHE_LIMIT) return
      for (const key of Array.from(cache.keys())) {
        if (Math.abs(key - i) > 40) cache.delete(key)
      }
    }

    const paint = () => {
      let img = cache.get(current)
      if (!ready(img)) {
        for (let d = 1; d <= 8; d++) {
          const a = cache.get(current - d)
          const b = cache.get(current + d)
          if (ready(a)) { img = a; break }
          if (ready(b)) { img = b; break }
        }
      }
      if (!ready(img)) return // poster behind shows through — never a blank flash
      const cw = canvas.clientWidth
      const ch = canvas.clientHeight
      const s = Math.max(cw / img!.naturalWidth, ch / img!.naturalHeight)
      const dw = img!.naturalWidth * s
      const dh = img!.naturalHeight * s
      ctx.clearRect(0, 0, cw, ch)
      ctx.drawImage(img!, (cw - dw) / 2, (ch - dh) / 2, dw, dh)
    }

    const sizeCanvas = () => {
      const coarse = window.matchMedia('(pointer: coarse)').matches
      const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2)
      const cw = canvas.clientWidth
      const ch = canvas.clientHeight
      canvas.width = Math.max(1, Math.round(cw * dpr))
      canvas.height = Math.max(1, Math.round(ch * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      dirty = true
    }

    sizeCanvas()
    for (let i = 0; i <= 8; i++) ensure(i)
    paint()

    const setStyle = (el: HTMLElement | null, v: string, last: { s: string }) => {
      if (!el || last.s === v) return
      last.s = v
      el.style.opacity = v
    }
    const lastVid = { s: '' }
    const lastCan = { s: '' }

    let raf = 0
    let running = true

    const loop = () => {
      raf = requestAnimationFrame(loop)
      const p = scrollSignal.progress
      if (p !== lastP) {
        lastP = p
        setStyle(video, videoOpacity(p).toFixed(3), lastVid)
        setStyle(canvasWrapRef.current, canvasOpacity(p).toFixed(3), lastCan)
        const idx = frameIndexFromProgress(p)
        if (idx !== current) {
          const forward = idx > current
          current = idx
          // Direction-biased prefetch: heavy ahead, light behind.
          for (let d = 1; d <= (forward ? 10 : 3); d++) ensure(idx + d)
          for (let d = 1; d <= (forward ? 3 : 10); d++) ensure(idx - d)
          trim(idx)
          dirty = true
        }
        if (p > CROSSFADE_END) {
          if (!video.paused) video.pause()
        } else if (video.paused) {
          void video.play().catch(() => {})
        }
      }
      if (dirty) {
        dirty = false
        paint()
      }
    }

    const start = () => {
      if (!running) return
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(loop)
    }
    const stop = () => cancelAnimationFrame(raf)

    // Pause all work while the section is offscreen (menu covers the page).
    const io = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting
        if (running) start()
        else stop()
      },
      { threshold: 0 },
    )
    io.observe(root.parentElement ?? root)

    const onVisibility = () => {
      if (document.hidden) stop()
      else if (running) start()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('resize', sizeCanvas)
    window.addEventListener('orientationchange', sizeCanvas)

    void video.play().catch(() => {})
    start()

    return () => {
      stop()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', sizeCanvas)
      window.removeEventListener('orientationchange', sizeCanvas)
      video.pause()
      cache.clear()
    }
  }, [reduced])

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[5] overflow-hidden bg-obsidian"
    >
      {/* Base fallback poster — shows through while frames decode or if media fails.
          Uses a beat from the scrub film itself so the handoff never flashes. */}
      <img
        src={STAGE_POSTER_URL}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />

      {!reduced && (
        <>
          {/* Layer A — opening video, normal autoplay (muted loop), not scroll-scrubbed */}
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: 1 }}
            src={VIDEO_URL}
            poster={POSTER_URL}
            muted
            loop
            playsInline
            preload="auto"
            tabIndex={-1}
          />

          {/* Layer B — frame-scrub canvas, faded in over the video by the master timeline */}
          <div ref={canvasWrapRef} className="absolute inset-0" style={{ opacity: 0 }}>
            <canvas ref={canvasRef} className="h-full w-full" />
          </div>
        </>
      )}

      {/* Vignette so the existing overlay type stays readable over any frame */}
      <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/10 to-obsidian/40" />
    </div>
  )
}
