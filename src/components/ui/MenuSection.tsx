import { useEffect, useState } from 'react'
import { useCatalogStore, hasRemoteCatalog } from '../../core/stores/useCatalogStore'
import { EMPTY_OPTIONS, EMPTY_PRODUCTS } from './CollectionOverlay'
import { useCartStore } from '../../core/stores/useCartStore'
import { useCollectionStore } from '../../core/stores/useCollectionStore'
import { formatNaira } from '../../core/commerce/money'
import type { Product } from '../../core/data/catalogTypes'

/** Card photo — hides itself cleanly when the file is missing. */
function CardImage({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false)
  if (!product.image || failed) return null
  return (
    <img
      src={product.image}
      alt={`${product.name} — demo photo`}
      loading="lazy"
      onError={() => setFailed(true)}
      className="mb-4 h-36 w-full rounded-lg object-cover"
    />
  )
}

export function MenuSection() {
  const { status, snapshot, load } = useCatalogStore()
  const addConfigured = useCartStore((s) => s.addConfigured)
  const openCart = useCartStore((s) => s.open)
  const openDetail = useCollectionStore((s) => s.openDetail)
  const startConfigure = useCollectionStore((s) => s.startConfigure)

  useEffect(() => {
    void load()
  }, [load])

  const products = snapshot?.products ?? EMPTY_PRODUCTS
  const options = snapshot?.options ?? EMPTY_OPTIONS
  const categories = [...new Set(products.map((p) => p.category))]

  return (
    <section id="menu" className="relative z-30 bg-obsidian/95 px-5 py-20 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-[length:var(--text-eyebrow)] tracking-[0.45em] uppercase text-ember">The Menu</p>
        <h2 className="mt-3 font-[family-name:var(--font-display)] text-[length:var(--text-section)] font-semibold text-cream">
          Choose your fire
        </h2>
        {!hasRemoteCatalog && (
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-ash">
            Showing <strong className="text-gold">DEMO</strong> products and prices for flow testing —
            real items, prices and availability come from the restaurant database (Firebase) once connected.
          </p>
        )}

        {status === 'error' && (
          <p role="alert" className="mt-8 rounded border border-ember/40 bg-ember/10 p-4 text-sm text-flame">
            Menu could not be loaded. <button className="underline" onClick={() => void load()}>Retry</button>
          </p>
        )}

        {status === 'loading' && (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
            {[0, 1, 2, 3].map((n) => <div key={n} className="h-56 animate-pulse rounded-xl bg-coal-2" />)}
          </div>
        )}

        {status === 'ready' &&
          categories.map((cat) => (
            <div key={cat} className="mt-12">
              <h3 className="text-xs tracking-[0.35em] uppercase text-ash">{cat}</h3>
              <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {products.filter((p) => p.category === cat).map((item) => (
                  <li key={item.id} className="flex flex-col justify-between rounded-xl border border-charcoal-line bg-coal p-5 transition-all hover:-translate-y-0.5 hover:border-ember/50 hover:shadow-glow">
                    <div>
                      <CardImage product={item} />
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="font-[family-name:var(--font-display)] text-xl text-cream">{item.name}</h4>
                        <span className="shrink-0 rounded-full border border-ash/30 px-2 py-0.5 text-[9px] tracking-widest uppercase text-ash">
                          {item.demo ? 'demo' : ''}{item.available ? '' : ' · out'}
                        </span>
                      </div>
                      {item.description && <p className="mt-2 text-xs leading-relaxed text-ash">{item.description}</p>}
                    </div>
                    <div className="mt-5 flex items-center justify-between">
                      <span className={`text-sm font-semibold ${item.available ? 'text-gold' : 'text-ash line-through'}`}>
                        {formatNaira(item.priceKobo)}
                      </span>
                      <div className="flex gap-2">
                        {item.groups?.length ? (
                          <button
                            onClick={() => { openDetail(item.id); startConfigure() }}
                            className="min-h-11 rounded-full bg-ember px-4 py-1.5 text-[10px] font-semibold tracking-[0.2em] uppercase text-obsidian hover:bg-flame"
                          >
                            Customize
                          </button>
                        ) : (
                          <button
                            disabled={!item.available}
                            onClick={() => { addConfigured(item, options, {}); openCart() }}
                            className="min-h-11 rounded-full border border-ember/60 px-4 py-1.5 text-[10px] font-semibold tracking-[0.2em] uppercase text-ember hover:bg-ember hover:text-obsidian disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </section>
  )
}
