import { useEffect, useMemo, useState } from 'react'
import { useCatalogStore } from '../../core/stores/useCatalogStore'
import { useCollectionStore } from '../../core/stores/useCollectionStore'
import { useCartStore } from '../../core/stores/useCartStore'
import { formatNaira } from '../../core/commerce/money'
import {
  validateConfig,
  configUnitKobo,
  type Selections,
} from '../../core/commerce/configurator'
import type { OptionGroup, Product, ProductOption } from '../../core/data/catalogTypes'

/** stable empty arrays so zustand getSnapshot caching is preserved */
export const EMPTY_PRODUCTS: Product[] = []
export const EMPTY_OPTIONS: ProductOption[] = []

/** Detail-card photo — hides itself when the file is missing. */
function DetailImage({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      src={src}
      alt={`${name} — demo photo`}
      loading="lazy"
      onError={() => setFailed(true)}
      className="mt-3 h-40 w-full rounded-xl object-cover"
    />
  )
}

/**
 * Collection overlay: keyboard/touch product strip, detail card and the
 * 3D-aware configurator. Works fully without WebGL (DOM-only path) and keeps
 * scroll position when entering/leaving details.
 */

const ASSET_TINT: Record<string, string> = {
  'meat-chicken': '#c98a4b',
  'meat-beef': '#8a3d16',
  'meat-mixed': '#a35a28',
  'sauce-garlic': '#efe4c8',
  'sauce-hot': '#d84022',
  'sauce-tahini': '#e0cfa5',
  'extra-fries': '#f5b93e',
  'extra-cheese': '#f0d27a',
}

function SchematicPreview({ options, selections }: {
  options: ProductOption[]
  selections: Selections
}) {
  const chosen = options.filter((o) => (selections[o.groupId] ?? []).includes(o.id))
  const meat = chosen.find((o) => o.assetKey?.startsWith('meat-'))
  const sauces = chosen.filter((o) => o.assetKey?.startsWith('sauce-'))
  const large = chosen.some((o) => o.assetKey === 'size-large')
  const extras = chosen.filter((o) => o.assetKey?.startsWith('extra-'))
  return (
    <div aria-hidden="true" className="relative mx-auto h-36 w-36">
      <div
        className="absolute inset-x-2 bottom-2 top-8 rounded-[40%_40%_38%_38%/30%_30%_60%_60%] bg-gradient-to-b from-[#d8a86a] to-[#b9834a] shadow-glow transition-transform duration-500"
        style={{ transform: large ? 'scale(1.12)' : 'scale(1)' }}
      />
      {meat?.assetKey && (
        <div
          className="absolute inset-x-6 bottom-16 h-4 rounded-full transition-colors duration-500"
          style={{ background: ASSET_TINT[meat.assetKey] }}
        />
      )}
      {sauces.map((s) => (
        <div
          key={s.id}
          className="absolute inset-x-8 bottom-[86px] h-1.5 rounded-full transition-all duration-500"
          style={{ background: ASSET_TINT[s.assetKey!] ?? '#fff', transform: `translateX(${sauces.indexOf(s) * 4 - 2}px)` }}
        />
      ))}
      {extras.map((x) => (
        <div
          key={x.id}
          className="absolute bottom-[104px] h-2.5 w-2.5 rounded-full"
          style={{ background: ASSET_TINT[x.assetKey!] ?? '#fff', left: x.assetKey === 'extra-fries' ? '30%' : '60%' }}
        />
      ))}
      <p className="absolute -bottom-5 inset-x-0 text-center text-[9px] tracking-[0.3em] uppercase text-ash">
        schematic preview
      </p>
    </div>
  )
}

function GroupControl({ group, options, value, onChange }: {
  group: OptionGroup
  options: ProductOption[]
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const single = group.max === 1
  const groupOptions = options.filter((o) => group.optionIds.includes(o.id))
  return (
    <fieldset className="mt-4">
      <legend className="text-[11px] tracking-[0.3em] uppercase text-ember">
        {group.name}{group.min > 0 ? ' · required' : ` · optional (max ${group.max})`}
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {groupOptions.map((o) => {
          const on = value.includes(o.id)
          return (
            <button
              key={o.id}
              type="button"
              role={single ? 'radio' : 'checkbox'}
              aria-checked={on}
              onClick={() => {
                if (single) onChange([o.id])
                else onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id])
              }}
              className={`min-h-11 rounded-full border px-4 py-2 text-xs transition-colors ${
                on ? 'border-ember bg-ember/15 text-flame' : 'border-charcoal-line text-smoke hover:border-ember/50'
              }`}
            >
              {o.name}
              {o.priceKobo > 0 && <span className="ml-1.5 text-gold">+{formatNaira(o.priceKobo)}</span>}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Quantity stepper — clamped 1..99, keyboard/touch friendly (44px targets). */
function QtyStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Quantity">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        aria-label="Decrease quantity"
        className="min-w-11 min-h-11 rounded-full border border-charcoal-line text-smoke hover:border-ember hover:text-flame"
      >
        −
      </button>
      <span className="w-8 text-center text-sm text-cream" aria-live="polite">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(99, value + 1))}
        aria-label="Increase quantity"
        className="min-w-11 min-h-11 rounded-full border border-charcoal-line text-smoke hover:border-ember hover:text-flame"
      >
        +
      </button>
    </div>
  )
}

export function CollectionOverlay() {
  const mode = useCollectionStore((s) => s.mode)
  const productId = useCollectionStore((s) => s.productId)
  const startConfigure = useCollectionStore((s) => s.startConfigure)
  const back = useCollectionStore((s) => s.back)
  const close = useCollectionStore((s) => s.close)
  const products = useCatalogStore((s) => s.snapshot?.products ?? EMPTY_PRODUCTS)
  const options = useCatalogStore((s) => s.snapshot?.options ?? EMPTY_OPTIONS)
  const addConfigured = useCartStore((s) => s.addConfigured)
  const openCart = useCartStore((s) => s.open)

  // Menu/dialog driven: the dialog opens from its own mode, independent of
  // any scroll position (works from the menu, keyboard or deep links).
  const visible = mode === 'detail' || mode === 'configure'
  const product = products.find((p) => p.id === productId)

  const [selections, setSelections] = useState<Selections>({})
  const [qty, setQty] = useState(1)
  useEffect(() => {
    // default-select required single-choice groups (e.g. filling, size)
    const init: Selections = {}
    for (const g of product?.groups ?? []) {
      if (g.min === 1 && g.max === 1) init[g.id] = [g.optionIds[0]]
    }
    setSelections(init)
    setQty(1)
  }, [productId, product])

  const validation = useMemo(
    () => (product ? validateConfig(product, options, selections) : null),
    [product, options, selections],
  )
  const unitKobo = product ? configUnitKobo(product, options, selections) : 0
  const customizable = Boolean(product?.groups?.length)

  if (!visible) return null

  return (
    <>
      {(mode === 'detail' || mode === 'configure') && product && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={`${product.name} details`}
          className="fixed inset-x-4 bottom-20 z-40 mx-auto max-h-[62vh] w-auto max-w-md overflow-y-auto rounded-2xl border border-ember/30 bg-coal/95 p-5 shadow-glow backdrop-blur-md sm:inset-x-auto sm:right-8 sm:w-96"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] tracking-[0.35em] uppercase text-ember">
                {customizable && mode === 'configure' ? 'Configure' : 'Product'}
                {product.demo ? ' · demo data' : ''}
              </p>
              <h3 className="mt-1 font-[family-name:var(--font-display)] text-2xl text-cream">{product.name}</h3>
            </div>
            <button onClick={close} aria-label="Back to collection" className="min-w-11 min-h-11 -m-2 text-ash hover:text-flame">✕</button>
          </div>

          {product.image && <DetailImage src={product.image} name={product.name} />}
          {product.description && <p className="mt-2 text-xs leading-relaxed text-ash">{product.description}</p>}

          {!product.available ? (
            <p role="alert" className="mt-4 rounded border border-ember/40 bg-ember/10 p-3 text-sm text-flame">
              Currently unavailable — the restaurant sets live availability.
            </p>
          ) : (
            <>
              {mode === 'configure' && customizable ? (
                <>
                  <div className="mt-4 mb-10">
                    <SchematicPreview options={options} selections={selections} />
                  </div>
                  {product.groups!.map((g) => (
                    <GroupControl
                      key={g.id}
                      group={g}
                      options={options}
                      value={selections[g.id] ?? []}
                      onChange={(ids) => setSelections((s) => ({ ...s, [g.id]: ids }))}
                    />
                  ))}
                  {validation && !validation.valid && (
                    <ul className="mt-3 space-y-1 text-xs text-flame" role="alert">
                      {Object.entries(validation.errors).map(([gid, msg]) => <li key={gid}>{msg}</li>)}
                    </ul>
                  )}
                  <div className="mt-5 flex items-center justify-between border-t border-charcoal-line pt-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-ash">
                        Unit price{product.demo ? ' (demo)' : ''} · {formatNaira(unitKobo)}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-gold">{formatNaira(unitKobo * qty)}</p>
                      <div className="mt-2">
                        <QtyStepper value={qty} onChange={setQty} />
                      </div>
                    </div>
                    <button
                      disabled={!validation?.valid}
                      onClick={() => {
                        addConfigured(product, options, selections, qty)
                        close()
                        openCart()
                      }}
                      className="rounded-full bg-ember px-6 py-2.5 text-[11px] font-semibold tracking-[0.2em] uppercase text-obsidian hover:bg-flame disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Add {qty > 1 ? `${qty} ` : ''}to cart
                    </button>
                  </div>
                  <button onClick={back} className="mt-3 text-xs tracking-widest uppercase text-ash hover:text-flame">
                    ← Back to product
                  </button>
                </>
              ) : (
                <div className="mt-5 space-y-3">
                  <p className="text-sm text-cream">
                    {formatNaira(product.priceKobo)}{' '}
                    {product.demo && <span className="text-xs text-ash">(demo price — unconfirmed)</span>}
                  </p>
                  <QtyStepper value={qty} onChange={setQty} />
                  <div className="flex flex-wrap gap-3">
                    {customizable && (
                      <button
                        onClick={startConfigure}
                        className="min-h-11 rounded-full bg-ember px-6 py-2.5 text-[11px] font-semibold tracking-[0.2em] uppercase text-obsidian hover:bg-flame"
                      >
                        Customize
                      </button>
                    )}
                    <button
                      onClick={() => {
                        addConfigured(product, options, {}, qty)
                        close()
                        openCart()
                      }}
                      className={`min-h-11 rounded-full border px-6 py-2.5 text-[11px] font-semibold tracking-[0.2em] uppercase ${
                        customizable ? 'border-charcoal-line text-smoke hover:border-ember/50' : 'bg-ember text-obsidian hover:bg-flame'
                      }`}
                    >
                      {customizable ? `Add ${qty > 1 ? `${qty} ` : ''}as standard` : `Add ${qty > 1 ? `${qty} ` : ''}to cart`}
                    </button>
                  </div>
                  <button onClick={back} className="text-xs tracking-widest uppercase text-ash hover:text-flame">
                    ← Back to collection
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}
