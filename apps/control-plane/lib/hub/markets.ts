import { dayMs, isoDay, mapLimit, optional, sectors, stocks, userAgent, type Index, type Stock, type Ticker } from './types.js'

export type Close = { symbol: string; day: string; price: number; currency: string }
type Point = { day: string; price: number }
type Chart = { closes: Close[]; live: Point | null; asOf: string; currency: string }
const round = (n: number) => Number(n.toFixed(4))
const pct = (last: number, base: number) => round(100 * (last / base - 1))
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
export function validSymbol(symbol: string) {
  return /^[A-Z][A-Z0-9]{0,9}(?:[.-][A-Z0-9]{1,5})?$/.test(symbol)
}

export function parseYahoo(symbol: string, payload: any, now: number): Chart | null {
  const r = payload?.chart?.result?.[0]
  const m = r?.meta
  if (!validSymbol(symbol) || m?.symbol !== symbol || !/^[A-Za-z]{3}$/.test(m.currency ?? '')) return null
  const pence = ['GBp', 'GBX'].includes(m.currency)
  const currency = pence ? 'GBP' : m.currency.toUpperCase()
  const price = (p: number) => p / (pence ? 100 : 1)
  const closes: Close[] = []
  const session = m.currentTradingPeriod?.regular
  const times = Array.isArray(r.timestamp) ? r.timestamp : []
  for (const [i, t] of times.entries()) {
    const p = r.indicators?.quote?.[0]?.close?.[i]
    if (!positive(t) || t * 1000 > now || !positive(p)) continue
    // An open session's candle is a quote. Only finished days enter the close history.
    if (session && t >= session.start && now < session.end * 1000) continue
    if (!session && isoDay(t * 1000) === isoDay(now)) continue
    closes.push({ symbol, day: isoDay(t * 1000), currency, price: price(p) })
  }
  const stamp = m.regularMarketTime
  const live = positive(stamp) && stamp * 1000 <= now && positive(m.regularMarketPrice)
    ? { day: isoDay(stamp * 1000), price: price(m.regularMarketPrice) } : null
  if (!closes.length && !live) return null
  return { currency, closes, live, asOf: live ? new Date(stamp * 1000).toISOString() : closes.at(-1)!.day }
}

export async function fetchMarkets(now: number) {
  const charts = await mapLimit(Object.keys(stocks), 4, async symbol => optional('quote ' + symbol, null, async () => {
    if (!validSymbol(symbol)) throw Error('invalid_symbol')
    const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + symbol + '?range=1mo&interval=1d',
      { headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(6500) })
    const chart = r.ok && parseYahoo(symbol, await r.json(), now)
    if (!chart) throw Error('missing_quote')
    return chart
  }))
  return Object.fromEntries(Object.keys(stocks).map((symbol, i) => [symbol, charts[i]])) as Record<string, Chart | null>
}

// Same starting capital per member. Carry the last observed close on exchange holidays.
// Members without an opening observation cannot enter part way through the series.
export function equalWeight(histories: Point[][]): Index {
  const dates = [...new Set(histories.flat().map(p => p.day))].sort()
  if (!dates.length) return { series: [], day_pct: null, month_pct: null }
  // The exchanges can reopen on different days after the month's opening holiday.
  // Rebase at their first shared observation; a new listing weeks later has no monthly base.
  const openingWeek = isoDay(Date.parse(dates[0]) + 6 * dayMs)
  const eligible = histories.filter(h => h.length && h[0].day <= openingWeek)
  const start = eligible.map(h => h[0].day).sort().at(-1)!
  const members = eligible.map(h => ({ h, base: h.filter(p => p.day <= start).at(-1)!.price }))
  const tradingDays = [...new Set(eligible.flat().map(p => p.day))].filter(day => day >= start).sort()
  const series = tradingDays.map(day => members.reduce((sum, { h,base }) =>
    sum + 100 * h.filter(p => p.day <= day).at(-1)!.price / base, 0) / members.length)
  return { series: series.map(round), day_pct: series.length > 1 ? pct(series.at(-1)!, series.at(-2)!) : null,
    month_pct: series.length > 1 ? pct(series.at(-1)!, series[0]) : null }
}

export function buildMarkets(now: number, saved: Close[], charts: Record<string, Chart | null>, prior?: Ticker) {
  const first = new Date(now)
  const dayOfMonth = first.getUTCDate()
  first.setUTCDate(1)
  first.setUTCMonth(first.getUTCMonth() - 1)
  const monthEnd = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  first.setUTCDate(Math.min(dayOfMonth, monthEnd))
  const start = isoDay(+first)
  const histories: Record<string, Point[]> = {}
  const quotes: Record<string, Stock> = {}
  for (const [symbol, info] of Object.entries(stocks)) {
    const chart = charts[symbol]
    const previous = prior?.stocks[symbol]
    const history = saved.filter(p => p.symbol === symbol && p.day <= isoDay(now)).sort((a,b) => a.day.localeCompare(b.day))
    const currency = chart?.currency ?? history.at(-1)?.currency ?? previous?.currency ?? null
    const points = new Map<string, number>()
    if (previous?.currency === currency && previous?.spark_dates) {
      previous.spark_dates.forEach((day,i) => {
        if (positive(previous.spark[i])) points.set(day, previous.spark[i])
      })
    }
    if (previous?.currency === currency && previous?.as_of && positive(previous.price)) {
      points.set(previous.as_of.slice(0,10),previous.price)
    }
    for (const row of [...history, ...(chart?.closes ?? [])]) {
      if (positive(row.price) && row.currency === currency) points.set(row.day, row.price)
    }
    if (chart?.live) {
      const newerObservation = previous?.currency === currency && previous?.as_of?.slice(0,10) === chart.live.day &&
        previous.as_of > chart.asOf && positive(previous.price)
      points.set(chart.live.day,newerObservation ? previous.price : chart.live.price)
    }
    const all = [...points].sort(([a],[b]) => a.localeCompare(b)).map(([day, price]) => ({ day, price }))
    const base = all.filter(p => p.day <= start).at(-1)
    const span = all.filter(p => p.day >= start)
    if (base && base.day < start && base.day >= isoDay(+first - 7 * dayMs)) span.unshift({ ...base, day: start })
    histories[symbol] = span
    const last = all.at(-1)
    const observed = [chart?.asOf, previous?.as_of, last?.day].filter(s => s?.slice(0,10) === last?.day && s).sort().at(-1)
    quotes[symbol] = { ...info, price: last?.price ?? null, currency, as_of: observed ?? null,
      missing: !chart, day_pct: all.length > 1 ? pct(last!.price, all.at(-2)!.price) : null,
      month_pct: span.length > 1 && Date.parse(span[0].day) <= +first + 6 * dayMs ? pct(last!.price, span[0].price) : null,
      spark: span.map(p => p.price), spark_dates: span.map(p => p.day) }
  }
  const indexFor = (symbols: string[]) => {
    const members = symbols.map(s => histories[s]).filter(h => h.length)
    const index = equalWeight(members)
    if (!members.some(h => Date.parse(h[0].day) <= +first + 6 * dayMs)) index.month_pct = null
    return index
  }
  const ticker: Ticker = { as_of: Object.values(quotes).map(q => q.as_of).filter(Boolean).sort().at(-1) ?? null,
    index: { name: 'Creative 24', ...indexFor(Object.keys(stocks)) }, stocks: quotes }
  return { ticker, indexes: Object.fromEntries(sectors.map(s =>
    [s.key, indexFor(Object.keys(stocks).filter(k => stocks[k].subsector === s.key))])) as Record<string, Index> }
}
