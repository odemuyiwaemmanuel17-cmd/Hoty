/**
 * Hot & Appetizing — server-authoritative commerce functions.
 *
 * These replace the old Supabase RPCs (validate_checkout / create_order /
 * update_order_status). The Admin SDK here is the ONLY writer of orders —
 * Firestore security rules deny all direct client writes. Admin rights are
 * re-checked SERVER-SIDE against the config/admins document on every
 * privileged call; browser storage or hand-crafted payloads can never
 * grant them.
 */
const crypto = require('crypto')
const functions = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()
const db = admin.firestore()

// Mirrors src/core/admin/orderStatus.ts EXACTLY — the client mirror is UX only.
const TRANSITIONS = {
  pending_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'completed', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

const MAX_ITEMS = 30 // Firestore document-limit + field-value 'in' guard

async function isAdminEmail(email) {
  if (!email) return false
  try {
    const snap = await db.collection('config').doc('admins').get()
    if (!snap.exists) return false
    const emails = (snap.data().emails || []).map((e) => String(e).toLowerCase())
    return emails.includes(String(email).toLowerCase())
  } catch (e) {
    return false
  }
}

async function getAllDocs(refs) {
  if (!refs.length) return []
  const out = []
  for (let i = 0; i < refs.length; i += 30) out.push(...(await db.getAll(...refs.slice(i, i + 30))))
  return out
}

async function queryIn(coll, field, values) {
  const snaps = []
  for (let i = 0; i < values.length; i += 30) {
    snaps.push(await coll.where(field, 'in', values.slice(i, i + 30)).get())
  }
  return snaps.flatMap((s) => s.docs)
}

/**
 * Recompute the cart from Firestore data. Never trusts browser prices:
 * unit = server product price + server option prices; qty clamped 1–99.
 */
async function validateItems(rawItems, fulfillment) {
  const issues = []
  const lines = []
  let subtotal = 0

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, issues: ['cart is empty'], lines, subtotal_kobo: 0, delivery_fee_kobo: null }
  }
  if (rawItems.length > MAX_ITEMS) {
    return { ok: false, issues: ['too many distinct cart lines'], lines, subtotal_kobo: 0, delivery_fee_kobo: null }
  }
  if (fulfillment !== 'pickup' && fulfillment !== 'delivery') {
    return { ok: false, issues: ['bad fulfillment'], lines, subtotal_kobo: 0, delivery_fee_kobo: null }
  }

  const items = rawItems.map((i) => ({
    product_id: String(i.product_id || ''),
    qty: Math.min(Math.max(parseInt(i.qty, 10) || 1, 1), 99),
    option_ids: Array.isArray(i.option_ids) ? i.option_ids.map(String) : [],
  }))

  const productIds = [...new Set(items.map((i) => i.product_id))]
  const productDocs = await getAllDocs(productIds.map((id) => db.doc('products', id)))
  const products = new Map(productDocs.filter((d) => d.exists).map((d) => [d.id, d.data()]))

  const groupDocs = await queryIn(db.collection('option_groups'), 'product_id', productIds)
  const groups = new Map(groupDocs.map((g) => [g.id, { ...g.data(), id: g.id }]))
  const optionsDocs = await queryIn(
    db.collection('product_options'),
    'group_id',
    [...groups.keys()],
  )
  const options = new Map(optionsDocs.map((o) => [o.id, { ...o.data(), id: o.id }]))

  for (const it of items) {
    const product = products.get(it.product_id)
    if (!product) {
      issues.push('product not found')
      continue
    }
    if (product.archived === true || product.available === false) {
      issues.push(`${product.name}: unavailable`)
      continue
    }

    const myGroups = [...groups.values()].filter((g) => g.product_id === it.product_id)
    const myGroupIds = new Set(myGroups.map((g) => g.id))
    let unit = Number(product.price_kobo || 0)
    const chosenNames = []

    for (const id of it.option_ids) {
      const opt = options.get(id)
      if (!opt || !myGroupIds.has(opt.group_id)) {
        issues.push(`${product.name}: invalid option selection`)
        continue
      }
      if (opt.available === false) {
        issues.push(`${product.name}: option unavailable`)
        continue
      }
      unit += Number(opt.price_kobo || 0)
      chosenNames.push(opt.name)
      const clash = it.option_ids.some(
        (other) => other !== id && (opt.incompatible_with || []).includes(other),
      )
      if (clash) issues.push(`${product.name}: incompatible options`)
    }

    for (const g of myGroups) {
      const chosen = it.option_ids.filter((id) => options.get(id) && options.get(id).group_id === g.id).length
      const min = Number(g.min_selections || 0)
      const max = Number(g.max_selections == null ? 1 : g.max_selections)
      if (chosen < min) issues.push(`${product.name}: ${g.name} required`)
      if (chosen > max) issues.push(`${product.name}: too many ${g.name}`)
    }

    const sortedIds = [...it.option_ids].sort()
    const lineKey = `${it.product_id}::${sortedIds.join('+')}`
    subtotal += unit * it.qty
    lines.push({
      key: lineKey,
      product_id: it.product_id,
      name: product.name,
      qty: it.qty,
      option_ids: sortedIds,
      option_names: it.option_ids.map((id) => (options.get(id) ? options.get(id).name : id)),
      unit_kobo: unit,
      subtotal_kobo: unit * it.qty,
    })
  }

  // Delivery fee is NEVER assumed — null until the restaurant configures it.
  let deliveryFee = null
  if (fulfillment === 'delivery') {
    const fs = await db.collection('config').doc('fulfillment').get()
    if (fs.exists) {
      const v = fs.data().delivery_fee_kobo
      if (v != null) deliveryFee = Number(v)
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    lines,
    subtotal_kobo: subtotal,
    delivery_fee_kobo: deliveryFee,
    order_ref: null,
  }
}

exports.validateCheckout = functions.https.onCall(async (data) => {
  return validateItems(data.items, data.fulfillment)
})

/**
 * Intentional, idempotent order creation. The order document id is derived
 * from the idempotency key, so a double-submit (or retry after a network
 * hiccup) cannot create two records — the second call returns the first
 * order's reference with duplicate: true.
 */
exports.createOrder = functions.https.onCall(async (data, context) => {
  const key = typeof data.idempotency_key === 'string' ? data.idempotency_key.slice(0, 200) : null
  if (!key) return { ok: false, issues: ['missing idempotency key'] }

  const check = await validateItems(data.items, data.fulfillment)
  if (!check.ok) return { ok: false, issues: check.issues }

  const docId = 'idem_' + crypto.createHash('sha256').update(key).digest('hex').slice(0, 40)
  const refDoc = db.collection('orders').doc(docId)

  const now = new Date()
  const ref =
    'HA-' +
    now.getUTCFullYear() +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0') +
    '-' +
    String(now.getUTCHours()).padStart(2, '0') +
    String(now.getUTCMinutes()).padStart(2, '0') +
    String(now.getUTCSeconds()).padStart(2, '0') +
    '-' +
    crypto.randomBytes(2).toString('hex')

  const orderDoc = {
    ref,
    status: 'pending_confirmation',
    fulfillment: data.fulfillment,
    subtotal_kobo: check.subtotal_kobo,
    delivery_fee_kobo: check.delivery_fee_kobo,
    customer_name: data.customer_name || null,
    customer_contact: data.customer_contact || null,
    notes: data.notes || null,
    idempotency_key: key,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    items: check.lines.map((l) => ({
      product_id: l.product_id,
      product_name_snapshot: l.name,
      unit_kobo: l.unit_kobo,
      qty: l.qty,
      options: l.option_ids.map((id, idx) => ({
        option_id: id,
        option_name_snapshot: l.option_names[idx] || id,
        price_kobo: 0, // names are snapshots; amounts were folded into unit_kobo authoritatively
      })),
    })),
    history: [
      {
        from_status: null,
        to_status: 'pending_confirmation',
        changed_by: context.auth && context.auth.email ? context.auth.email : null,
        changed_at: admin.firestore.FieldValue.serverTimestamp(),
      },
    ],
  }

  try {
    await refDoc.create(orderDoc)
    return { ok: true, order_ref: ref, order_id: docId, duplicate: false }
  } catch (e) {
    if (e && e.code === 6) {
      // ALREADY_EXISTS → this exact submission was already recorded.
      const existing = await refDoc.get()
      return {
        ok: true,
        order_ref: existing.exists ? existing.data().ref : ref,
        order_id: docId,
        duplicate: true,
      }
    }
    throw e
  }
})

/**
 * Status transitions — admins only, re-authorized on every call, and the
 * transition table is enforced here regardless of what the client believes.
 */
exports.updateOrderStatus = functions.https.onCall(async (data, context) => {
  const adminOk = await isAdminEmail(context.auth && context.auth.email)
  if (!adminOk) return { ok: false, error: 'Not authorized.' }

  const { order_id: orderId, to } = data
  if (!(to in TRANSITIONS)) return { ok: false, error: 'Unknown status.' }
  const doc = db.collection('orders').doc(String(orderId))
  const snap = await doc.get()
  if (!snap.exists) return { ok: false, error: 'Order not found.' }

  const from = snap.data().status
  if (!(TRANSITIONS[from] || []).includes(to)) {
    return { ok: false, error: `Cannot move from ${from} to ${to}.` }
  }

  await doc.update({
    status: to,
    history: admin.firestore.FieldValue.arrayUnion({
      from_status: from,
      to_status: to,
      changed_by: context.auth.email,
      changed_at: new Date().toISOString(),
    }),
  })
  return { ok: true }
})
