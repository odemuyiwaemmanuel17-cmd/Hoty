import { useSceneStore } from '../../core/stores/useSceneStore'
import { sceneActivity } from '../../core/scene/sceneDirector'

/**
 * Oversized display type rendered UNDER the canvas layer (z-[4] vs z-[5]) so
 * the hero photo occludes it — the reference-short look where the headline
 * passes behind the food. Pure DOM: no font downloads, no WebGL cost.
 */
export function HeroBackdrop() {
  const progress = useSceneStore((s) => s.progress)
  const fade = Math.max(0, sceneActivity(progress).hero)
  if (fade < 0.02) return null
  const t = Math.min(1, progress / 0.2)
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[4] flex items-center justify-center overflow-hidden"
      aria-hidden="true"
      style={{ opacity: fade }}
    >
      <span
        className="select-none font-[family-name:var(--font-display)] text-[26vw] font-bold uppercase leading-none text-transparent"
        style={{
          WebkitTextStroke: '1.5px rgba(255,107,24,0.30)',
          transform: `translateY(${-t * 7}vh) scale(${1 + t * 0.22})`,
        }}
      >
        Shawarma
      </span>
      <span
        className="absolute bottom-[16%] right-[6%] text-[10px] uppercase tracking-[0.5em] text-ember/60 sm:bottom-[20%] sm:right-[10%]"
        style={{ transform: `translateY(${t * 4}vh)` }}
      >
        est. Ijegun
      </span>
    </div>
  )
}
