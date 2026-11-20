/** A sourced amount as a viewer reads it: 195 "THOUSAND DOLLARS" is "$195,000", never "195" over a unit line (the
 *  20 Nov 2026 recipe samples). Scale words (thousand, million, billion) multiply the value, a currency word becomes its
 *  sign, and what is left of the unit stays as the unit line. A unit with neither is drawn exactly as before. */
const SCALES: Record<string, number> = { THOUSAND: 1e3, MILLION: 1e6, BILLION: 1e9 }
const CURRENCIES: Record<string, string> = { DOLLARS: '$', DOLLAR: '$', USD: '$', POUNDS: '£', POUND: '£', GBP: '£', EUROS: '€', EURO: '€', EUR: '€' }

export function formatAmount(value: number, unit: string): { text: string; unit: string } {
  const words = unit.trim().split(/\s+/).filter(Boolean)
  let scale = 1
  let sign = ''
  const rest: string[] = []
  for (const word of words) {
    const key = word.toUpperCase()
    if (SCALES[key] !== undefined && !sign && scale === 1) scale = SCALES[key]!
    else if (CURRENCIES[key] !== undefined && !sign) sign = CURRENCIES[key]!
    else rest.push(word)
  }
  if (scale === 1 && !sign) return { text: String(value), unit }
  const n = value * scale
  // A billion or more keeps its word ("$1.2 billion"); anything less is written out in full with thousands separators.
  if (n >= 1e9) return { text: `${sign}${+(n / 1e9).toFixed(2)} billion`, unit: rest.join(' ') }
  const places = Number.isInteger(n) ? 0 : 2
  const text = n.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places })
  return { text: `${sign}${text}`, unit: rest.join(' ') }
}
