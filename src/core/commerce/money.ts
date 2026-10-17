/**
 * Integer money utilities — all monetary values are kobo (₦ × 100)
 * to avoid float drift. Display converts with formatNaira().
 */

export function addKobo(...amounts: number[]): number {
  let total = 0
  for (const a of amounts) {
    if (!Number.isInteger(a)) throw new Error(`kobo values must be integers, got ${a}`)
    total += a
  }
  return total
}

export function mulKobo(kobo: number, qty: number): number {
  if (!Number.isInteger(kobo) || !Number.isInteger(qty))
    throw new Error('kobo and qty must be integers')
  return kobo * qty
}

/** "₦2,500" or "₦2,500.50" — only shows decimals when present. */
export function formatNaira(kobo: number): string {
  const sign = kobo < 0 ? '-' : ''
  const abs = Math.abs(kobo)
  const naira = Math.floor(abs / 100)
  const cents = abs % 100
  const grouped = naira.toLocaleString('en-NG')
  return `${sign}₦${grouped}${cents ? `.${String(cents).padStart(2, '0')}` : ''}`
}
