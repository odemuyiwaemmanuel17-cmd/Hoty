import { Navbar } from './components/ui/Navbar'
import { LoadingScreen } from './components/ui/LoadingScreen'
import { HeroOverlay } from './components/ui/HeroOverlay'
import { FoodScrollStage } from './components/ui/FoodScrollStage'
import { StoryHandoff } from './components/ui/StoryHandoff'
import { MenuSection } from './components/ui/MenuSection'
import { Footer } from './components/ui/Footer'
import { CartButton, CartPanel } from './components/ui/CartPanel'
import { CollectionOverlay } from './components/ui/CollectionOverlay'
import { useReducedMotion } from './core/hooks/useReducedMotion'
import { useHeroScroll } from './core/hooks/useHeroScroll'

export default function App() {
  const reduced = useReducedMotion()

  // ONE master scroll timeline for the food section (video → 270-frame scrub).
  useHeroScroll('scroll-space')

  return (
    <div className="film-grain relative min-h-screen">
      <a
        href="#menu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-ember focus:px-4 focus:py-2 focus:text-obsidian"
      >
        Skip to menu
      </a>

      <Navbar />

      <main className="relative z-20">
        {/* The existing food section — the video + 270-frame scrub stage is now
            its dominant background, replacing the old decorative food plates. */}
        <div id="scroll-space" className="relative">
          <FoodScrollStage />

          <section id="hero" className="pointer-events-none relative z-20 h-[100svh]">
            <HeroOverlay cinematic={!reduced} />
          </section>

          {/* Scroll runway for the frame sequence: grill → separation →
              floating ingredients → wrap → assembly → finished meal → menu. */}
          {!reduced && <div className="pointer-events-none h-[500svh]" aria-hidden="true" />}
        </div>

        <MenuSection />
        <Footer />
      </main>

      {/* finished meal → menu handoff, faded in by the same master timeline */}
      <StoryHandoff />

      <CartButton />
      <CartPanel />
      <CollectionOverlay />
      <LoadingScreen ready reducedMotion={reduced} />
    </div>
  )
}
