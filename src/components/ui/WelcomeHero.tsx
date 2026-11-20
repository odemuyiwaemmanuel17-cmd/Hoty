import { useEffect, useRef } from 'react';
import { scrollToExperience, scrollToSection } from '../../core/hooks/useHeroScroll';
import { POSTER_URL, WELCOME_VIDEO_URL } from '../../core/hybrid/hybridStory';
import { useReducedMotion } from '../../core/hooks/useReducedMotion';

export function WelcomeHero() {
  const reduced = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Autoplay video once the component mounts (muted, inline, autoplay)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.playsInline = true;
    void video.play().catch(() => {});
    return () => video.pause();
  }, []);

  return (
    <section
      className="pointer-events-none fixed inset-0 z-10 flex h-[100svh] w-full items-center justify-center overflow-hidden bg-black"
      aria-label="Welcome hero"
    >
      {/* Video (or poster fallback for reduced‑motion) */}
      {!reduced ? (
        <video
          ref={videoRef}
          src={WELCOME_VIDEO_URL}
          poster={POSTER_URL}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          playsInline
        />
      ) : (
        <img
          src={POSTER_URL}
          alt="Hot &amp; Appetizing – Shawarma"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Overlay content – branding + CTAs */}
      <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-6 px-4 text-center text-cream">
        <h1 className="font-[family-name:var(--font-display)] text-[12vw] font-bold uppercase tracking-[0.04em] text-ember">
          Hot &amp; Appetizing
        </h1>
        <p className="max-w-lg text-lg">
          Fresh off the grill. Made to satisfy.
        </p>

        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => scrollToExperience(reduced)}
            className="rounded-full bg-ember px-7 py-3 text-xs font-semibold uppercase text-obsidian transition-colors hover:bg-flame"
          >
            Explore the Experience
          </button>

          <button
            onClick={() => scrollToSection('menu', reduced)}
            className="rounded-full border border-cream/25 px-7 py-3 text-xs font-semibold uppercase text-cream transition-colors hover:border-ember hover:text-flame"
          >
            View Our Menu
          </button>
        </div>
      </div>
    </section>
  );
}
