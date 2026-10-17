import { BUSINESS } from '../business'
import { formatNaira } from './money'
import type { ValidatedCheckout, Fulfillment } from './checkout'

/**
 * WhatsApp click-to-chat message. Opening the URL is NOT order confirmation —
 * the message itself asks the restaurant to confirm availability and totals.
 * Delivery fee is always "pending confirmation" until the restaurant
 * configures one server-side.
 */
export function buildCheckoutMessage(co: ValidatedCheckout): string {
  const L: string[] = []
  L.push(`Hello ${BUSINESS.name}! I'd like to place an order.`)
  L.push('')
  if (co.orderRef) L.push(`Order reference: ${co.orderRef}`)
  if (co.hasDemoItems) L.push('DEMO ORDER — all listed prices are unconfirmed placeholders.')

  L.push('Items:')
  for (const line of co.lines) {
    L.push(`• ${line.name} ×${line.qty} — ${line.optionsLabel ? `(${line.optionsLabel}) ` : ''}${line.subtotalLabel}`)
  }
  L.push('')
  L.push(`Subtotal (provisional): ${formatNaira(co.subtotalKobo)}`)
  if (co.fulfillment === 'delivery') {
    L.push('Delivery fee: PENDING CONFIRMATION (please quote for my address)')
    L.push('No final payable total is presented until the delivery fee is confirmed.')
  } else {
    L.push('Fulfillment: Pickup at the restaurant')
  }
  L.push('')
  if (co.customerName) L.push(`Name: ${co.customerName}`)
  if (co.customerContact) L.push(`Contact: ${co.customerContact}`)
  if (co.notes) L.push(`Notes: ${co.notes}`)
  L.push('')
  L.push('Please confirm availability, final prices and total. I will pay/collect on your confirmation.')
  return L.join('\n')
}

export function whatsappCheckoutUrl(co: ValidatedCheckout): string {
  return `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(buildCheckoutMessage(co))}`
}

export function fulfillmentLabel(f: Fulfillment): string {
  return f === 'delivery' ? 'Delivery request' : 'Pickup'
}
