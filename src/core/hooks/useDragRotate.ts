import { useEffect, type RefObject } from 'react'
import { useSceneStore } from '../stores/useSceneStore'

/**
 * Horizontal pointer/touch drag → model azimuth. Vertical gestures pass
 * through to native page scroll (touch-action: pan-y on the target).
 */
export function useDragRotate(targetRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = targetRef.current
    if (!el || !enabled) return

    let dragging = false
    let lastX = 0
    let azimuth = useSceneStore.getState().dragAzimuth
    let raf = 0

    const onDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* synthetic or stale pointer id — capture is optional */
      }
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      azimuth += (e.clientX - lastX) * 0.008
      lastX = e.clientX
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => useSceneStore.getState().setDragAzimuth(azimuth))
    }
    const onUp = (e: PointerEvent) => {
      dragging = false
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        /* pointer already released */
      }
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)

    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
  }, [targetRef, enabled])
}
