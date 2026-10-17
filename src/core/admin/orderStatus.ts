/**
 * Order status model — the single client-side mirror of the server rules in
 * functions/index.js updateOrderStatus guard + Firestore security rules).
 * The DATABASE remains authoritative; this map only drives UI affordances
 * and is unit-tested against the same transition table.
 */
export const ORDER_STATUSES = [
  'pending_confirmation',
  'confirmed',
  'preparing',
  'ready',
  'completed',
  'cancelled',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_confirmation: 'Pending review',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready / dispatched',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'completed', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === 'string' && (ORDER_STATUSES as readonly string[]).includes(v)
}

export function canTransition(from: unknown, to: unknown): boolean {
  if (!isOrderStatus(from) || !isOrderStatus(to)) return false
  return TRANSITIONS[from].includes(to)
}

export function nextStatuses(from: unknown): OrderStatus[] {
  return isOrderStatus(from) ? [...TRANSITIONS[from]] : []
}
