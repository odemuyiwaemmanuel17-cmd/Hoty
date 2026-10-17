import { getFb } from './firebaseClient'
import { backendMode } from '../config/env'
import { canTransition, isOrderStatus, type OrderStatus } from './orderStatus'

/**
 * Admin data operations on Firestore. Security rules (firestore.rules) are
 * the actual authorization boundary — products/categories/options are
 * publicly readable, orders and admin config are admin-only, and NO client
 * (admin or not) may write orders directly: status changes go through the
 * `updateOrderStatus` Cloud Function, which re-verifies the caller's email
 * against config/admins and re-checks the transition server-side.
 */

export interface AdminProductRow {
  id: string
  name: string
  description: string | null
  price_kobo: number
  currency: string
  available: boolean
  archived: boolean
  image_url: string | null
  category_id: string | null
  position: number
  updated_at: string
}

export interface AdminCategoryRow {
  id: string
  name: string
  position: number
}

export interface OrderRow {
  id: string
  ref: string
  status: OrderStatus
  fulfillment: 'pickup' | 'delivery'
  subtotal_kobo: number
  delivery_fee_kobo: number | null
  customer_name: string | null
  customer_contact: string | null
  notes: string | null
  created_at: string
}

export interface OrderItemRow {
  id: string
  product_name_snapshot: string
  unit_kobo: number
  qty: number
}

export interface OrderItemOptionRow {
  order_item_id: string
  option_name_snapshot: string
  price_kobo: number
}

export interface StatusHistoryRow {
  from_status: string | null
  to_status: string
  changed_by: string | null
  changed_at: string
}

export interface Metrics {
  total_orders: number
  pending: number
  confirmed: number
  preparing: number
  ready: number
  completed: number
  cancelled: number
  booked_subtotal_kobo: number
}

function need(): Promise<NonNullable<Awaited<ReturnType<typeof getFb>>>> {
  return getFb().then((fb) => {
    if (!fb) throw new Error('Backend not configured')
    return fb
  })
}

const iso = (v: unknown): string => {
  const t = v as { toDate?: () => Date } | null | undefined
  if (t && typeof t.toDate === 'function') return t.toDate().toISOString()
  return String(t ?? '')
}

type OrderDoc = {
  ref: string
  status: OrderStatus
  fulfillment: 'pickup' | 'delivery'
  subtotal_kobo: number
  delivery_fee_kobo: number | null
  customer_name: string | null
  customer_contact: string | null
  notes: string | null
  created_at: unknown
  items?: {
    product_id?: string
    product_name_snapshot: string
    unit_kobo: number
    qty: number
    options?: { option_name_snapshot: string; price_kobo: number }[]
  }[]
  history?: { from_status: string | null; to_status: string; changed_by: string | null; changed_at: unknown }[]
}

function toOrderRow(id: string, d: OrderDoc): OrderRow {
  return {
    id,
    ref: d.ref,
    status: d.status,
    fulfillment: d.fulfillment,
    subtotal_kobo: Number(d.subtotal_kobo),
    delivery_fee_kobo: d.delivery_fee_kobo == null ? null : Number(d.delivery_fee_kobo),
    customer_name: d.customer_name ?? null,
    customer_contact: d.customer_contact ?? null,
    notes: d.notes ?? null,
    created_at: iso(d.created_at),
  }
}

/** Newest orders first (Firestore orders by created_at desc; capped, no offset paging needed at this scale). */
async function queryOrders(status?: OrderStatus | 'all', limit = 500) {
  const { collection, query, where, orderBy, limit: lim, getDocs } = await import('firebase/firestore')
  const fb = await need()
  const base = collection(fb.db, 'orders')
  const q =
    status && status !== 'all' && isOrderStatus(status)
      ? query(base, where('status', '==', status), orderBy('created_at', 'desc'), lim(limit))
      : query(base, orderBy('created_at', 'desc'), lim(limit))
  const snap = await getDocs(q)
  return snap.docs.map((s) => ({ id: s.id, data: s.data() as OrderDoc }))
}

export async function fetchMetrics(): Promise<Metrics> {
  const rows = await queryOrders('all', 1000)
  const m: Metrics = {
    total_orders: rows.length,
    pending: 0,
    confirmed: 0,
    preparing: 0,
    ready: 0,
    completed: 0,
    cancelled: 0,
    booked_subtotal_kobo: 0,
  }
  for (const r of rows) {
    const d = r.data
    if (d.status === 'pending_confirmation') m.pending++
    else if (d.status === 'confirmed') m.confirmed++
    else if (d.status === 'preparing') m.preparing++
    else if (d.status === 'ready') m.ready++
    else if (d.status === 'completed') m.completed++
    else if (d.status === 'cancelled') m.cancelled++
    if (d.status !== 'cancelled' && d.status !== 'pending_confirmation')
      m.booked_subtotal_kobo += Number(d.subtotal_kobo || 0)
  }
  return m
}

export async function fetchPopularProducts(): Promise<{ product_name_snapshot: string; units: number }[]> {
  const rows = await queryOrders('all', 1000)
  const units = new Map<string, number>()
  for (const r of rows) {
    if (r.data.status === 'cancelled') continue
    for (const it of r.data.items ?? []) {
      units.set(it.product_name_snapshot, (units.get(it.product_name_snapshot) ?? 0) + Number(it.qty || 0))
    }
  }
  return [...units.entries()]
    .map(([product_name_snapshot, u]) => ({ product_name_snapshot, units: u }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 8)
}

export async function fetchRecentOrders(limit = 15): Promise<OrderRow[]> {
  const rows = await queryOrders('all', limit)
  return rows.map((r) => toOrderRow(r.id, r.data))
}

export async function fetchOrders(status?: OrderStatus | 'all'): Promise<OrderRow[]> {
  const rows = await queryOrders(status, 200)
  return rows.map((r) => toOrderRow(r.id, r.data))
}

export async function fetchOrderDetail(id: string) {
  const { doc, getDoc } = await import('firebase/firestore')
  const fb = await need()
  const snap = await getDoc(doc(fb.db, 'orders', id))
  if (!snap.exists()) throw new Error('Order not found')
  const d = snap.data() as OrderDoc
  const items: OrderItemRow[] = (d.items ?? []).map((it, i) => ({
    id: `${id}-item-${i}`,
    product_name_snapshot: it.product_name_snapshot,
    unit_kobo: Number(it.unit_kobo),
    qty: Number(it.qty),
  }))
  const options: OrderItemOptionRow[] = []
  ;(d.items ?? []).forEach((it, i) => {
    for (const o of it.options ?? []) {
      options.push({
        order_item_id: `${id}-item-${i}`,
        option_name_snapshot: o.option_name_snapshot,
        price_kobo: Number(o.price_kobo),
      })
    }
  })
  const history: StatusHistoryRow[] = (d.history ?? []).map((h) => ({
    from_status: h.from_status ?? null,
    to_status: h.to_status,
    changed_by: h.changed_by ?? null,
    changed_at: iso(h.changed_at),
  }))
  return { order: toOrderRow(snap.id, d), items, options, history }
}

/**
 * Status change. With Cloud Functions the `updateOrderStatus` callable
 * re-verifies admin + transition server-side. In rules-only mode the update
 * goes straight to Firestore, where SECURITY RULES enforce the same admin
 * check and the same transition table (`status in allowedTransitions(...)`),
 * so a tampered client still cannot skip states or act without admin rights.
 */
export async function updateOrderStatus(id: string, to: OrderStatus): Promise<{ ok: boolean; error?: string }> {
  const fb = await getFb()
  if (!fb) return { ok: false, error: 'Backend not configured' }
  try {
    if (backendMode === 'functions') {
      const { httpsCallable } = await import('firebase/functions')
      const call = httpsCallable<{ order_id: string; to: OrderStatus }, { ok: boolean; error?: string }>(
        fb.fn,
        'updateOrderStatus',
      )
      const res = await call({ order_id: id, to })
      return res.data ?? { ok: false, error: 'no response' }
    }
    // rules-only: read current status, check the mirror client-side for UX,
    // then write — the rules refuse anything they disagree with regardless.
    const { doc, getDoc, updateDoc, arrayUnion, serverTimestamp } = await import('firebase/firestore')
    const snap = await getDoc(doc(fb.db, 'orders', id))
    if (!snap.exists()) return { ok: false, error: 'Order not found.' }
    const from = (snap.data() as OrderDoc).status
    if (!canTransition(from, to)) return { ok: false, error: `Cannot move from ${from} to ${to}.` }
    await updateDoc(doc(fb.db, 'orders', id), {
      status: to,
      history: arrayUnion({
        from_status: from,
        to_status: to,
        changed_by: (await getCurrentAdminEmail()) ?? 'admin',
        changed_at: new Date().toISOString(),
      }),
      updated_at: serverTimestamp(),
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Status update failed.' }
  }
}

async function getCurrentAdminEmail(): Promise<string | null> {
  const fb = await getFb()
  return fb?.auth.currentUser?.email ?? null
}

export async function fetchProductsForAdmin(): Promise<AdminProductRow[]> {
  const { collection, getDocs } = await import('firebase/firestore')
  const fb = await need()
  const snap = await getDocs(collection(fb.db, 'products'))
  return snap.docs
    .map((s) => {
      const d = s.data() as Record<string, unknown>
      return {
        id: s.id,
        name: String(d.name ?? ''),
        description: (d.description as string | null) ?? null,
        price_kobo: Number(d.price_kobo ?? 0),
        currency: String(d.currency ?? 'NGN'),
        available: d.available !== false,
        archived: d.archived === true,
        image_url: (d.image_url as string | null) ?? null,
        category_id: (d.category_id as string | null) ?? null,
        position: Number(d.position ?? 0),
        updated_at: iso(d.updated_at),
      }
    })
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
}

export async function fetchCategories(): Promise<AdminCategoryRow[]> {
  const { collection, getDocs } = await import('firebase/firestore')
  const fb = await need()
  const snap = await getDocs(collection(fb.db, 'categories'))
  return snap.docs
    .map((s) => {
      const d = s.data() as Record<string, unknown>
      return { id: s.id, name: String(d.name ?? ''), position: Number(d.position ?? 0) }
    })
    .sort((a, b) => a.position - b.position)
}

export interface ProductDraft {
  id?: string
  name: string
  description: string | null
  price_kobo: number
  available: boolean
  archived: boolean
  image_url: string | null
  category_id: string | null
}

/** Client-side validation (the function/rule layer is the backstop). */
export function validateDraft(d: ProductDraft): string | null {
  if (!d.name.trim()) return 'Product name is required.'
  if (d.name.trim().length > 120) return 'Product name is too long (max 120 characters).'
  if (!Number.isInteger(d.price_kobo) || d.price_kobo < 100 || d.price_kobo > 10_000_000)
    return 'Price must be a whole-naira amount between ₦1 and ₦100,000.'
  if (d.description && d.description.length > 600) return 'Description is too long (max 600 characters).'
  return null
}

export async function saveProduct(d: ProductDraft): Promise<string | null> {
  const invalid = validateDraft(d)
  if (invalid) return invalid
  const fb = await getFb()
  if (!fb) return 'Backend not configured'
  try {
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
    const id = d.id ?? crypto.randomUUID()
    await setDoc(
      doc(fb.db, 'products', id),
      {
        name: d.name.trim(),
        description: d.description?.trim() || null,
        price_kobo: d.price_kobo,
        currency: 'NGN',
        available: d.available,
        archived: d.archived,
        image_url: d.image_url,
        category_id: d.category_id,
        updated_at: serverTimestamp(),
      },
      { merge: true },
    )
    return null
  } catch (e) {
    return e instanceof Error ? e.message : 'Product could not be saved.'
  }
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** Upload to the products/ path (Storage rules: admins only). Returns a download URL. */
export async function uploadProductImage(file: File): Promise<{ url?: string; error?: string }> {
  if (!IMAGE_TYPES.includes(file.type)) return { error: 'Only JPEG, PNG or WebP images are allowed.' }
  if (file.size > MAX_IMAGE_BYTES) return { error: 'Image must be 2 MB or smaller.' }
  const fb = await getFb()
  if (!fb) return { error: 'Backend not configured' }
  try {
    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage')
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `products/${crypto.randomUUID()}.${ext}`
    await uploadBytes(ref(fb.storage, path), file, { contentType: file.type })
    const url = await getDownloadURL(ref(fb.storage, path))
    return { url }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Image upload failed.' }
  }
}

export { canTransition }
