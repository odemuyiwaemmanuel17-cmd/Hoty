import { INGREDIENT_LAYERS } from '../../core/data/ingredients'
import { useInteractionStore } from '../../core/stores/useInteractionStore'
import { scrollToSection } from '../../core/hooks/useHeroScroll'
import { useReducedMotion } from '../../core/hooks/useReducedMotion'

/**
 * Ingredient discovery card (Scene 4). DOM overlay for crisp type, large
 * touch targets and screen-reader access. Visual-only: never affects pricing.
 */
export function IngredientPanel() {
  const selected = useInteractionStore((s) => s.selected)
  const setSelected = useInteractionStore((s) => s.setSelected)
  const reduced = useReducedMotion()

  const layer = INGREDIENT_LAYERS.find((l) => l.id === selected)
  if (!layer) return null

  return (
    <div
      role="dialog"
      aria-label={`Ingredient details: ${layer.name}`}
      className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-sm rounded-2xl border border-ember/40 bg-coal/95 p-5 shadow-glow backdrop-blur-md sm:inset-x-auto sm:left-8 sm:bottom-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] tracking-[0.35em] uppercase text-ember">Ingredient · illustrative</p>
          <h3 className="mt-1 font-[family-name:var(--font-display)] text-2xl text-cream">{layer.name}</h3>
        </div>
        <button
          onClick={() => setSelected(null)}
          aria-label="Close ingredient details"
          className="min-w-11 min-h-11 -m-2 flex items-center justify-center rounded-full text-ash hover:text-flame"
        >
          ✕
        </button>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-smoke">{layer.description}</p>
      <div className="mt-4 flex gap-3">
        <button
          onClick={() => {
            setSelected(null)
            scrollToSection('menu', reduced)
          }}
          className="rounded-full bg-ember px-5 py-2.5 text-[11px] font-semibold tracking-[0.2em] uppercase text-obsidian hover:bg-flame"
        >
          View menu
        </button>
        <button
          onClick={() => setSelected(null)}
          className="rounded-full border border-charcoal-line px-5 py-2.5 text-[11px] font-semibold tracking-[0.2em] uppercase text-smoke hover:border-ember/50 hover:text-flame"
        >
          Back
        </button>
      </div>
    </div>
  )
}
