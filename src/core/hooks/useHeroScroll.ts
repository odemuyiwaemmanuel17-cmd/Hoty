import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { scrollSignal } from '../stores/useSceneStore'

gsap.registerPlugin(ScrollTrigger)

/**
 * THE one master scroll timeline. Writes ONLY to the mutable scrollSignal
 * channel — no React state per scroll event. Consumers (FoodScrollStage,
 * HeroOverlay, StoryHandoff) read scrollSignal inside their own rAF loops
 * and repaint only on real change. Single controller instance, disposed on
 * unmount so there are never duplicate triggers or leaks.
 */
export function useHeroScroll(regionId: string) {
  useEffect(() => {
    const region = document.getElementById(regionId)
    if (!region) return

    const st = ScrollTrigger.create({
      trigger: region,
      start: 'top top',
      end: 'bottom top',
      onUpdate: (self) => {
        scrollSignal.progress = self.progress
      },
    })

    return () => {
      st.kill(true)
    }
  }, [regionId])
}

/** Scroll to a section, honoring reduced motion. */
export function scrollToSection(id: string, reducedMotion: boolean) {
  const el = document.getElementById(id)
  if (!el) return
  window.scrollTo({
    top: el.getBoundingClientRect().top + window.scrollY,
    behavior: reducedMotion ? 'auto' : 'smooth',
  })
}
