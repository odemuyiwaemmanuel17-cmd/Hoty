import { useEffect, useState } from 'react'
import {
  fetchMetrics,
  fetchPopularProducts,
  fetchRecentOrders,
  fetchProductsForAdmin,
  type Metrics,
  type OrderRow,
  type AdminProductRow,
} from '../../core/admin/api'
import { STATUS_LABELS } from '../../core/admin/orderStatus'
import { formatNaira } from '../../core/commerce/money'

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready'
      metrics: Metrics
      recent: OrderRow[]
      popular: { product_name_snapshot: string; units: number }[]
      products: AdminProductRow[]
    }

/** Recorded-order overview. Every number comes from genuine order rows. */
export function Overview() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchMetrics(), fetchRecentOrders(8), fetchPopularProducts(), fetchProductsForAdmin()])
      .then(([metrics, recent, popular, products]) => {
        if (!cancelled) setState({ kind: 'ready', metrics, recent, popular, products })
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ kind: 'error', message: e instanceof Error ? e.message : 'Failed to load' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.kind === 'loading') return <Panel>Loading dashboard…</Panel>
  if (state.kind === 'error')
    return (
      <Panel>
        <p role="alert" className="text-sm text-flame">
          Could not load dashboard data: {state.message}
        </p>
      </Panel>
    )

  const { metrics, recent, popular, products } = state
  const live = products.filter((p) => !p.archived)

  return (
    <div className="space-y-8">
      <section aria-label="Order summary" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Recorded orders" value={String(metrics.total_orders)} />
        <Stat label="Pending review" value={String(metrics.pending)} accent />
        <Stat label="Completed" value={String(metrics.completed)} />
        <Stat label="Booked subtotal (non-cancelled)" value={formatNaira(metrics.booked_subtotal_kobo)} />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-xs uppercase tracking-[0.3em] text-ember">Status board</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.entries(STATUS_LABELS).map(([k, label]) => (
              <li key={k} className="flex justify-between border-b border-charcoal-line pb-2 text-smoke">
                <span>{label}</span>
                <span className="font-semibold text-cream">
                  {metrics[{ pending: 'pending', confirmed: 'confirmed', preparing: 'preparing', ready: 'ready', completed: 'completed', cancelled: 'cancelled' }[k] as keyof Metrics] as number}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-[0.3em] text-ember">Popular products (by ordered units)</h2>
          {popular.length === 0 ? (
            <p className="mt-3 text-sm text-ash">No recorded orders yet — popularity appears once orders are stored.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {popular.map((p, i) => (
                <li key={p.product_name_snapshot + i} className="flex justify-between border-b border-charcoal-line pb-2 text-smoke">
                  <span>{p.product_name_snapshot}</span>
                  <span className="font-semibold text-cream">{p.units}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <h2 className="text-xs uppercase tracking-[0.3em] text-ember">Recent orders</h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-ash">No orders recorded yet.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-ash">
              <tr>
                <th className="py-2">Ref</th>
                <th>When</th>
                <th>Status</th>
                <th className="text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id} className="border-t border-charcoal-line">
                  <td className="py-2 font-mono text-xs text-gold">{o.ref}</td>
                  <td className="text-xs text-smoke">{new Date(o.created_at).toLocaleString()}</td>
                  <td className="text-xs text-cream">{STATUS_LABELS[o.status] ?? o.status}</td>
                  <td className="text-right text-gold">{formatNaira(o.subtotal_kobo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-[0.3em] text-ember">Menu availability</h2>
        <p className="mt-2 text-sm text-smoke">
          {live.filter((p) => p.available).length} available · {live.filter((p) => !p.available).length} unavailable ·{' '}
          {products.filter((p) => p.archived).length} archived
        </p>
      </section>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-charcoal-line bg-coal p-4">
      <p className="text-[10px] uppercase tracking-[0.25em] text-ash">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent ? 'text-ember' : 'text-cream'}`}>{value}</p>
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-charcoal-line bg-coal p-6">{children}</div>
}
