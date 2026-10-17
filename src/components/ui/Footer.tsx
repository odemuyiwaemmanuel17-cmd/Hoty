import { BUSINESS } from '../../core/business'
import { CINEMATIC } from '../../assets/cinematic/assetManifest'
import { useSceneStore, type QualityTier } from '../../core/stores/useSceneStore'

const TIERS: { value: QualityTier; label: string }[] = [
  { value: 'low', label: 'Battery saver' },
  { value: 'medium', label: 'Balanced' },
  { value: 'high', label: 'Cinematic' },
]

export function Footer() {
  const quality = useSceneStore((s) => s.quality)
  const setQuality = useSceneStore((s) => s.setQuality)

  return (
    <footer id="visit" className="relative z-30 border-t border-charcoal-line bg-obsidian px-5 py-16 sm:px-10">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3">
        <div>
          <p className="font-[family-name:var(--font-display)] text-2xl text-cream">
            Hot <span className="text-ember">&amp;</span> Appetizing
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ash">{BUSINESS.tagline}</p>
          <img
            src={CINEMATIC.dine.url}
            alt="A plated shawarma wrap served at the restaurant"
            loading="lazy"
            className="mt-5 aspect-[3/2] w-full rounded-xl border border-charcoal-line object-cover"
          />
        </div>
        <address className="not-italic text-sm leading-relaxed text-smoke">
          <span className="mb-2 block text-xs tracking-[0.35em] uppercase text-ember">Find the fire</span>
          {BUSINESS.address}
          <br />
          <a className="mt-2 inline-block text-cream hover:text-flame" href={`tel:${BUSINESS.phoneE164}`}>
            {BUSINESS.phoneDisplay}
          </a>
          <br />
          <a
            className="inline-block text-cream hover:text-flame"
            href={`https://wa.me/${BUSINESS.whatsapp}`}
            target="_blank"
            rel="noreferrer"
          >
            Order on WhatsApp
          </a>
        </address>
        <div>
          <span className="mb-2 block text-xs tracking-[0.35em] uppercase text-ember">Visual quality</span>
          <div role="radiogroup" aria-label="Rendering quality" className="flex flex-wrap gap-2">
            {TIERS.map((t) => (
              <button
                key={t.value}
                role="radio"
                aria-checked={quality === t.value}
                onClick={() => setQuality(t.value)}
                className={`rounded-full border px-4 py-1.5 text-xs tracking-widest uppercase transition-colors ${
                  quality === t.value
                    ? 'border-ember bg-ember text-obsidian'
                    : 'border-charcoal-line text-smoke hover:border-ember/50 hover:text-flame'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ash">
            Auto-tuned to your device; override any time.
          </p>
        </div>
      </div>
      <p className="mx-auto mt-12 max-w-6xl text-[11px] text-ash">
        © {new Date().getFullYear()} {BUSINESS.name}. Menu items and pricing are confirmed by the
        restaurant directly.
      </p>
    </footer>
  )
}
