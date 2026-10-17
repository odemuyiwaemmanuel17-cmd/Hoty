import { useCallback, useEffect, useState } from 'react'
import {
  fetchOrderDetail,
  fetchOrders,
  updateOrderStatus,
  type OrderRow,
} from '../../core/admin/api'
import {
  nextStatuses,
  ORDER_STATUSES,
  STATUS_LABELS,
  type OrderStatus,
} from '../../core/admin/orderStatus'
import { formatNaira } from '../../core/commerce/money'

interface Detail {
  order: OrderRow
  items: { id: string; product_name_snapshot: string; unit_kobo: number; qty: number }[]
  options: { order_item_id: string; option_name_snapshot: string; price_kobo: number }[]
  history: { from_status: string | null; to_status: string; changed_by: string | null; changed_at: string }[]
}

/** Order management: real records only, validated status transitions,
 *  history timestamps, no duplicate submissions. */
export function OrdersAdmin() {
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all')
  const [orders, setOrders] = useState<OrderRow[] | null>(null)
  const [selected, setSelected] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setListError(null)
      setOrders(await fetchOrders(filter))
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : 'Failed to load orders')
    }
  }, [filter])

  useEffect(() => {
    void reload()
  }, [reload])

  const open = async (id: string) => {
    setError(null)
    try {
      setSelected(await fetchOrderDetail(id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load order')
    }
  }

  const transition = async (to: OrderStatus) => {
    if (!selected || busy) return
    if (!nextStatuses(selected.order.status).includes(to)) {
      setError('That status change is not allowed from the current status.')
      return
    }
    setBusy(true)
    setError(null)
    const res = await updateOrderStatus(selected.order.id, to)
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Status update failed.')
      return
    }
    await open(selected.order.id)
    void reload()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <section>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter orders by status">
          {(['all', ...ORDER_STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              aria-pressed={filter === s}
              className={`min-h-11 rounded-full border px-3 text-[10px] uppercase tracking-[0.15em] ${
                filter === s ? 'border-ember bg-ember/15 text-flame' : 'border-charcoal-line text-smoke hover:border-ember/50'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {listError && <p role="alert" className="mt-3 text-sm text-flame">{listError}</p>}
        {!orders && !listError && <p className="mt-4 text-sm text-ash">Loading orders…</p>}
        {orders && orders.length === 0 && (
          <p className="mt-4 text-sm text-ash">No recorded orders{filter !== 'all' ? ` in “${STATUS_LABELS[filter]}”` : ' yet'}. Orders appear here once the database is connected and customers check out.</p>
        )}
        <ul className="mt-3 space-y-2">
          {(orders ?? []).map((o) => (
            <li key={o.id}>
              <button
                onClick={() => void open(o.id)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  selected?.order.id === o.id ? 'border-ember/60 bg-coal' : 'border-charcoal-line bg-coal/60 hover:border-ember/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gold">{o.ref}</span>
                  <span className="text-[10px] uppercase tracking-widest text-ember">{STATUS_LABELS[o.status] ?? o.status}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-ash">
                  <span>{new Date(o.created_at).toLocaleString()}</span>
                  <span className="text-gold">{formatNaira(o.subtotal_kobo)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        {!selected && <div className="rounded-xl border border-charcoal-line bg-coal p-6 text-sm text-ash">Select an order to see items, customer details and status history.</div>}
        {selected && (
          <div className="rounded-xl border border-charcoal-line bg-coal p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-sm text-gold">{selected.order.ref}</h3>
              <span className="text-[10px] uppercase tracking-widest text-ember">{STATUS_LABELS[selected.order.status]}</span>
            </div>
            <p className="mt-1 text-xs text-ash">
              {new Date(selected.order.created_at).toLocaleString()} · {selected.order.fulfillment === 'delivery' ? 'Delivery request' : 'Pickup'}
            </p>
            {selected.order.customer_name && <p className="mt-2 text-sm text-smoke">{selected.order.customer_name}{selected.order.customer_contact ? ` · ${selected.order.customer_contact}` : ''}</p>}
            {selected.order.notes && <p className="mt-1 text-xs text-gold">Notes: {selected.order.notes}</p>}

            <ul className="mt-4 space-y-3">
              {selected.items.map((it) => (
                <li key={it.id} className="border-b border-charcoal-line pb-2 text-sm">
                  <div className="flex justify-between text-cream">
                    <span>{it.product_name_snapshot} ×{it.qty}</span>
                    <span className="text-gold">{formatNaira(it.unit_kobo * it.qty)}</span>
                  </div>
                  <p className="text-xs text-ash">{formatNaira(it.unit_kobo)} each (price at order time)</p>
                  {selected.options.filter((o) => o.order_item_id === it.id).length > 0 && (
                    <p className="mt-1 text-xs text-smoke">
                      {selected.options.filter((o) => o.order_item_id === it.id).map((o) => o.option_name_snapshot).join(', ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-3 flex justify-between text-sm">
              <span className="text-smoke">Subtotal</span>
              <span className="font-semibold text-gold">{formatNaira(selected.order.subtotal_kobo)}</span>
            </div>
            {selected.order.fulfillment === 'delivery' && (
              <p className="mt-1 text-xs text-gold">
                Delivery fee: {selected.order.delivery_fee_kobo == null ? 'pending confirmation' : formatNaira(selected.order.delivery_fee_kobo)}
              </p>
            )}

            <h4 className="mt-5 text-[10px] uppercase tracking-[0.3em] text-ember">Move to</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {nextStatuses(selected.order.status).length === 0 && (
                <span className="text-xs text-ash">Terminal status — no further changes.</span>
              )}
              {nextStatuses(selected.order.status).map((s) => (
                <button
                  key={s}
                  disabled={busy}
                  onClick={() => void transition(s)}
                  className={`min-h-11 rounded-full px-4 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                    s === 'cancelled'
                      ? 'border border-ember/50 text-flame hover:bg-ember/10'
                      : 'bg-ember text-obsidian hover:bg-flame'
                  } disabled:opacity-40`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            {error && <p role="alert" className="mt-3 text-xs text-flame">{error}</p>}

            {selected.history.length > 0 && (
              <>
                <h4 className="mt-5 text-[10px] uppercase tracking-[0.3em] text-ember">History</h4>
                <ul className="mt-2 space-y-1 text-xs text-ash">
                  {selected.history.map((h, i) => (
                    <li key={i}>
                      {new Date(h.changed_at).toLocaleString()} — {h.from_status ?? 'created'} → {h.to_status}
                      {h.changed_by ? ` (${h.changed_by})` : ''}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
