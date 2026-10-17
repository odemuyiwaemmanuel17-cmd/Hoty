# Hot & Appetizing — Cinematic Shawarma Ordering Experience

Premium dark-luxury, mobile-first cinematic site for
**Hot & Appetizing** — Last Bus Stop, Ijegun–Ikotun Road, Alimosho, Lagos · +234 707 751 1756.

One continuous customer journey:

> auto-playing film opening → single scroll-scrubbed frame sequence (grill → ingredients →
> wrap → assembly → finished plated meal) → menu discovery → configurator → cart → WhatsApp order.

## Stack

React 18 · Vite 5 · TypeScript (strict) · GSAP ScrollTrigger (one master timeline) ·
Tailwind CSS v4 · Zustand — **Firebase-ready** (Auth + Firestore + Storage + Cloud Functions).
(`three`/`@react-three/fiber`/`@react-three/drei` remain installed and the 3D scene modules
are preserved under `src/components/three/`, but they are **no longer in the entry bundle** —
the video + frame-scrub stage replaced the 3D corridor as the scroll timeline.)

## Run

```bash
npm install
npm run dev        # development
npm run build      # tsc -b + production build
npm run preview    # serve dist/
npm test           # vitest suite (57 tests)
```

Motion: the site respects `prefers-reduced-motion`. Reduced-motion visitors get a static
poster hero and reach the menu without any scrub. Test overrides: `?motion=full` / `?motion=reduced`.

## The cinematic engine

- `public/media/shawarma-intro.mp4` — the opening film (normal autoplay: muted, loop,
  playsInline, poster fallback). It is never scroll-scrubbed.
- `public/frames/shawarma/ezgif-frame-001.jpg … 224` — the same 10.01 s film dissected into
  270 frames; the scrub uses frames 001–224 and **ends on the finished plated meal**
  (the abstract vortex tail 225–270 is intentionally unused).
- `src/core/hybrid/hybridStory.ts` — pure scroll→media mapping (crossfade window, frame index,
  meal hold, handoff timing). Unit-tested; reversible by construction.
- `src/core/hooks/useHeroScroll.ts` — THE one ScrollTrigger (over `#scroll-space`); writes only
  to the mutable `scrollSignal` channel. No React state updates per scroll event.
- `src/components/ui/FoodScrollStage.tsx` — fixed canvas stage; one rAF loop with dirty-flag
  repaint, bounded frame cache (≤64), direction-biased prefetch, DPR capped (2 / 1.5 coarse),
  IntersectionObserver + visibilitychange pausing, poster `<img>` beneath as the universal
  fallback (video error, frame error, or mid-decode → never a blank flash).
- `src/components/ui/StoryHandoff.tsx` — "Explore Menu / Order on WhatsApp" fades in over the
  held plated meal and releases before the menu slides over the stage.

Scroll performance (measured in-browser during a full 2.5 s scrub): avg/p95/worst frame 17 ms,
zero long tasks >50 ms; total JS ≈ 79 kB gzip.

## Commerce

- **Catalog** (`core/data/menuSource.ts`): Firebase-first adapter; without env config it serves
  the clearly-labelled **DEMO** catalog (`demoCatalog.ts`) — demo items, demo prices, one
  deliberately unavailable product. No real menu data is invented.
- **Configurator** (`CollectionOverlay.tsx` + `core/commerce/configurator.ts`): database-shaped
  groups (min/max), incompatibility rules, quantity stepper, live integer-kobo pricing,
  radiogroup/checkbox semantics, ≥44px targets, Escape/back routing. Opens from the menu
  independent of scroll position.
- **Cart v2** (`useCartStore`): configuration signatures (identical configs merge, different
  configs stay separate lines), add/remove/qty (clamped 1–99), kobo-integer totals
  (`core/commerce/money.ts`), localStorage persistence (`ha-cart-v2`), empty state with a
  route back to the menu, provisional-total disclaimer.
- **WhatsApp checkout** (`CheckoutDrawer.tsx` + `core/commerce/checkout.ts` + `whatsapp.ts`):
  revalidates on every change (server Callable `validateCheckout` when configured; demo recomputation otherwise),
  surfaces price-change/unavailability issues before sending, pickup vs delivery (delivery fee
  is always "PENDING CONFIRMATION" — never a fake payable total), optional name/contact/notes,
  opens `wa.me/2347077511756` with a fully URL-encoded order draft, duplicate-submit guard,
  and explicit semantics: **opening WhatsApp is not order confirmation** — the restaurant
  confirms availability and final prices.

## Admin dashboard (`/admin`) — Phase 5

Private restaurant management area, code-split into its own lazy chunk (the homepage never
loads admin or Firebase-SDK code — the `firebase` package is dynamically imported only when
a backend is configured and an admin/checkout action runs).

**Two backend modes** (`VITE_BACKEND_MODE`, default `rules-only`):
- **rules-only** (free Spark plan): no Cloud Functions, no Storage needed. Totals are computed
  in-app from the live Firestore menu (never editable display text); orders are written
  directly to Firestore as **UNVERIFIED `pending_confirmation` drafts** whose shape is
  strictly enforced by security rules (draft status only, bounded totals, `idem_` doc ids).
  Status transitions are enforced by the rules' `allowedTransitions()` table, so a tampered
  client still cannot skip states or act without admin rights. The UI labels these orders as
  drafts for WhatsApp confirmation. Product images use pasted public URLs.
- **functions** (Blaze plan): deploy `functions/` — `validateCheckout`/`createOrder`
  recompute prices server-side and write verified records; `updateOrderStatus` re-checks
  admin + transition in code. Storage uploads enabled via `storage.rules`.

- **Authorization is enforced server-side**, not UI-hidden: Firebase Auth (email/password) +
  Firestore/Storage **security rules** (`firestore.rules`, `storage.rules`) + **Cloud Functions**
  (`functions/index.js`). Admin = any signed-in email listed in the `config/admins` document,
  re-checked on every privileged read/write. A tampered frontend gains nothing: rules return
  zero rows for non-admins, orders are **never client-writable** (only the Admin SDK in
  Functions writes them), and `updateOrderStatus` re-verifies admin + transition server-side.
  Bootstrap the owner by creating `config/admins` = `{ emails: ["owner@email.com"] }` in the
  console. No service-account keys or passwords in frontend code — only the public web config.
- **Overview**: recorded-order counts by status, booked subtotal (non-cancelled), recent
  orders, popular products by ordered units, availability summary — all from genuine rows;
  zero records shows an honest empty state, never fabricated numbers.
- **Menu management**: create/edit products (name, description, validated naira price,
  category), availability toggle, archive (soft-delete hiding a product from the public menu
  while preserving order history), image upload to Storage `products/` (rules: admins only,
  JPEG/PNG/WebP ≤ 2 MB). Customer menu reads the same collections, so edits appear immediately.
  Inventory quantities are NOT tracked (availability only) — deliberately not faked.
- **Order management**: order list with status filters; detail shows reference, timestamp,
  items with options and **historical prices snapshotted at order time**, customer info,
  fulfillment, notes and full status history. Status changes go through the `updateOrderStatus`
  Callable, which re-validates the transition server-side
  (`pending review → confirmed → preparing → ready → completed`, cancellable until terminal)
  and records who/when. Idempotency keys are per drawer-session (hash + nonce); the order
  document id is derived from the key so retries dedupe without colliding different
  customers' identical carts.
- **WhatsApp ↔ records**: when the backend is configured, checkout calls the `createOrder`
  Callable FIRST (server recomputes prices from Firestore); the returned reference
  (e.g. `HA-20261016-…`) is embedded in the WhatsApp draft. Persistence failure = WhatsApp
  does not open and no success is claimed. In demo mode the UI states plainly that the order
  is NOT stored anywhere.
- **Not configured?** `/admin` renders a Firebase setup checklist (project, rules/functions
  deploy, `config/admins`, env vars) instead of any demo data.

## Structure

```
src/
├─ App.tsx                     # composition root: timeline hook + stage + menu + overlays
├─ core/
│  ├─ business.ts              # restaurant facts (address, phone, WhatsApp)
│  ├─ hybrid/hybridStory.ts    # pure scroll→video/frame/handoff mapping
│  ├─ commerce/                # money (kobo), configurator, checkout validation, whatsapp
│  ├─ data/                    # catalog types, demo catalog, Firebase adapter, ingredients
│  ├─ hooks/                   # useHeroScroll (master timeline), useReducedMotion, asset probes
│  ├─ scene/ + three/          # preserved 3D corridor (unmounted; kept for future re-enable)
│  └─ stores/                  # useCartStore (persisted), useSceneStore (+ scrollSignal), …
└─ components/ui/              # FoodScrollStage, HeroOverlay, StoryHandoff, MenuSection,
                               # CollectionOverlay, CartPanel, CheckoutDrawer, Navbar, Footer…
public/
├─ media/                      # shawarma-intro.mp4 + shawarma-poster.jpg
├─ frames/shawarma/            # 270 film frames (001–224 used)
└─ images/cinematic/           # processed product/hero photography (see images/README.md)
```

## Assets & licensing

Photography and the film/frames were supplied by the restaurant owner for this project;
originals are preserved under `public/images/_src2/`. Do not republish them elsewhere.
`firestore.rules` + `functions/index.js` hold the (not yet deployed) backend: public-read menu
collections, admin-only writes, order reads, and `validateCheckout` / `createOrder` /
`updateOrderStatus` callables with server-side pricing. `supabase/migrations/*.sql` are kept as
the superseded design record from the earlier stack.

## Verified

- `tsc -b` clean · 57/57 vitest · `vite build` green.
- Live browser passes (desktop 1280×800, mobile 390×844, reduced-motion): video autoplay,
  crossfade, forward/reverse scrub, meal hold + handoff, menu, configurator quantity,
  cart merge/totals/persistence across reload, empty-cart route, Escape-to-close,
  WhatsApp URL contents (recipient, items, options, qty, subtotal, pending delivery fee,
  contact, notes, no-false-confirmation), duplicate guard, no horizontal overflow, clean console.
- Scroll performance measured during a full scrub: avg/p95/worst frame 17 ms, zero long tasks.
- Admin logic (status transitions, idempotency semantics, product validation, no-fake-success
  recording) covered by unit tests; `/admin` code-split verified in the production bundle
  (homepage never fetches the dashboard or Firebase-SDK chunks).
- Live-DB checks (security-rule enforcement, sign-in, menu edits, order flow) require a
  Firebase project and are listed as launch TODOs below.

## Next

1. Provision a Firebase project (Auth email/password, Firestore, Storage), deploy
   `firebase deploy --only firestore:rules,firestore:indexes,storage:rules,functions`, create
   the owner's auth user, add their email to `config/admins` = `{ emails: ["owner@…"] }`, load
   real menu data, and set the `VITE_FIREBASE_*` web-config variables — the UI then switches to
   server-validated pricing and real order records automatically (DEMO badges disappear only
   when real records exist).
2. Configure a genuine delivery fee server-side (a `config/fulfillment` doc with
   `delivery_fee_kobo`) if the restaurant offers delivery.
3. Deploy the SPA with a fallback so `/admin` serves `index.html` (`firebase.json` hosting
   rewrite included; `public/_redirects` also present for Netlify).
