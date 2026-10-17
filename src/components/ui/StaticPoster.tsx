import { forwardRef } from 'react'
import { CINEMATIC } from '../../assets/cinematic/assetManifest'

/**
 * Cinematic poster used as:
 *  - static hero when WebGL is unavailable,
 *  - graceful fallback when the production shawarma model/photo is missing.
 * Built on the owner-uploaded hero photography — no fake food geometry.
 */
export const StaticPoster = forwardRef<HTMLDivElement>(function StaticPoster(_props, ref) {
  return (
    <div
      ref={ref}
      data-poster
      className="absolute inset-0 z-10 overflow-hidden"
      style={{
        touchAction: 'pan-y',
        background: 'linear-gradient(180deg, #0a0a0b 0%, #101013 58%, #0a0a0b 100%)',
      }}
      aria-hidden="true"
    >
      <img
        src={CINEMATIC.hero.url}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-70"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 118%, #ff6b1833 0%, #ff6b1814 28%, transparent 55%),' +
            'radial-gradient(70% 55% at 18% 82%, #ff8a3d1c 0%, transparent 60%)',
        }}
      />
      {/* ember horizon glow */}
      <div
        className="absolute bottom-0 left-1/2 h-40 w-[70%] -translate-x-1/2 rounded-[50%] blur-3xl"
        style={{ background: 'radial-gradient(closest-side, #ff6b1855, transparent)' }}
      />
      {/* flame glyph */}
      <svg
        className="absolute left-1/2 top-[38%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 opacity-70 sm:h-32 sm:w-32"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M12 2c1 3.5-2.5 4.8-2.5 8A4.5 4.5 0 0 0 14 14.5c.8-.8 1.2-1.8 1.2-2.8 1.4 1.2 2.3 3 2.3 5A5.5 5.5 0 0 1 12 22a5.5 5.5 0 0 1-5.5-5.3C6.2 10.5 11 8 12 2Z"
          fill="url(#emberGrad)"
        />
        <defs>
          <linearGradient id="emberGrad" x1="12" y1="2" x2="12" y2="22">
            <stop offset="0" stopColor="#f5b93e" />
            <stop offset="1" stopColor="#ff6b18" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
})
