import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchCategories,
  fetchProductsForAdmin,
  saveProduct,
  uploadProductImage,
  type AdminCategoryRow,
  type AdminProductRow,
  type ProductDraft,
} from '../../core/admin/api'
import { formatNaira } from '../../core/commerce/money'

const emptyDraft = (): ProductDraft => ({
  name: '',
  description: '',
  price_kobo: 0,
  available: true,
  archived: false,
  image_url: null,
  category_id: null,
})

/** Menu management — edits persist to the same products table the customer
 *  menu reads (via menuSource), so changes appear on the site immediately. */
export function MenuManager() {
  const [products, setProducts] = useState<AdminProductRow[] | null>(null)
  const [categories, setCategories] = useState<AdminCategoryRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<ProductDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([fetchProductsForAdmin(), fetchCategories()])
      setProducts(p)
      setCategories(c)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load products')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const toggle = async (p: AdminProductRow, field: 'available' | 'archived') => {
    const err = await saveProduct({
      id: p.id,
      name: p.name,
      description: p.description,
      price_kobo: p.price_kobo,
      available: field === 'available' ? !p.available : p.available,
      archived: field === 'archived' ? !p.archived : p.archived,
      image_url: p.image_url,
      category_id: p.category_id,
    })
    if (err) setError(err)
    else void reload()
  }

  const save = async () => {
    if (!draft) return
    setBusy(true)
    setError(null)
    const err = await saveProduct(draft)
    setBusy(false)
    if (err) setError(err)
    else {
      setDraft(null)
      setNotice('Saved — the customer menu reads the same records.')
      void reload()
    }
  }

  const pickImage = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    const res = await uploadProductImage(file)
    setBusy(false)
    if (res.error) setError(res.error)
    else if (res.url && draft) setDraft({ ...draft, image_url: res.url })
  }

  if (error && !products) return <Shell><p role="alert" className="text-sm text-flame">{error}</p></Shell>
  if (!products) return <Shell>Loading menu…</Shell>

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-[0.3em] text-ember">Products ({products.length})</h2>
        <button
          onClick={() => { setDraft(emptyDraft()); setError(null) }}
          className="min-h-11 rounded-full bg-ember px-5 text-xs font-semibold uppercase tracking-[0.2em] text-obsidian hover:bg-flame"
        >
          New product
        </button>
      </div>
      {notice && <p className="mt-2 text-xs text-gold">{notice}</p>}

      <table className="mt-4 w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-ash">
          <tr>
            <th className="py-2">Product</th>
            <th>Category</th>
            <th className="text-right">Price</th>
            <th className="text-center">Available</th>
            <th className="text-center">Archived</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className={`border-t border-charcoal-line ${p.archived ? 'opacity-50' : ''}`}>
              <td className="py-2 text-cream">
                {p.name}
                {p.archived && <span className="ml-2 text-[9px] uppercase tracking-widest text-ash">archived</span>}
              </td>
              <td className="text-xs text-smoke">{categories.find((c) => c.id === p.category_id)?.name ?? '—'}</td>
              <td className="text-right text-gold">{formatNaira(p.price_kobo)}</td>
              <td className="text-center">
                <input type="checkbox" checked={p.available} onChange={() => void toggle(p, 'available')} aria-label={`Available ${p.name}`} />
              </td>
              <td className="text-center">
                <input type="checkbox" checked={p.archived} onChange={() => void toggle(p, 'archived')} aria-label={`Archived ${p.name}`} />
              </td>
              <td className="text-right">
                <button
                  onClick={() => {
                    setDraft({
                      id: p.id, name: p.name, description: p.description, price_kobo: p.price_kobo,
                      available: p.available, archived: p.archived, image_url: p.image_url, category_id: p.category_id,
                    })
                    setError(null)
                  }}
                  className="text-xs uppercase tracking-widest text-smoke hover:text-flame"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] text-ash">
        Archiving hides a product from the customer menu without deleting it — past orders keep their snapshots.
        Availability is a live toggle; quantities (inventory) are not tracked.
      </p>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/80 p-4" role="dialog" aria-modal="true" aria-label="Product editor">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-charcoal-line bg-coal p-6">
            <h3 className="font-[family-name:var(--font-display)] text-xl text-cream">{draft.id ? 'Edit product' : 'New product'}</h3>
            <Field label="Name">
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Description">
              <textarea rows={2} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Price (₦)">
              <input
                type="number" min={1} step={50}
                value={draft.price_kobo / 100 || ''}
                onChange={(e) => setDraft({ ...draft, price_kobo: Math.round(Number(e.target.value) * 100) })}
                className={inputCls}
              />
            </Field>
            <Field label="Category">
              <select
                value={draft.category_id ?? ''}
                onChange={(e) => setDraft({ ...draft, category_id: e.target.value || null })}
                className={inputCls}
              >
                <option value="">— none —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Image">
              <div className="flex items-center gap-3">
                {draft.image_url && <img src={draft.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                <button onClick={() => fileRef.current?.click()} disabled={busy} className="min-h-11 rounded-full border border-charcoal-line px-4 text-xs uppercase tracking-widest text-smoke hover:border-ember">
                  {busy ? 'Uploading…' : 'Upload (JPEG/PNG/WebP ≤2MB)'}
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void pickImage(e.target.files?.[0])} />
              </div>
              <input
                type="url"
                value={draft.image_url ?? ''}
                onChange={(e) => setDraft({ ...draft, image_url: e.target.value.trim() || null })}
                placeholder="…or paste a public image URL (works without Firebase Storage)"
                className={`${inputCls} mt-2`}
              />
            </Field>
            <label className="mt-3 flex items-center gap-2 text-sm text-smoke">
              <input type="checkbox" checked={draft.available} onChange={(e) => setDraft({ ...draft, available: e.target.checked })} /> Available
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm text-smoke">
              <input type="checkbox" checked={draft.archived} onChange={(e) => setDraft({ ...draft, archived: e.target.checked })} /> Archived
            </label>
            {error && <p role="alert" className="mt-3 rounded border border-ember/40 bg-ember/10 p-2 text-xs text-flame">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button onClick={() => void save()} disabled={busy} className="min-h-11 flex-1 rounded-full bg-ember px-5 text-xs font-semibold uppercase tracking-[0.2em] text-obsidian hover:bg-flame disabled:opacity-40">
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setDraft(null)} className="min-h-11 rounded-full border border-charcoal-line px-5 text-xs uppercase tracking-[0.2em] text-smoke hover:border-ember">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}

const inputCls = 'mt-1 w-full rounded-lg border border-charcoal-line bg-obsidian px-3 py-2.5 text-sm text-cream'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="mt-3 block text-xs text-ash">{label}{children}</label>
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-charcoal-line bg-coal p-6">{children}</div>
}
