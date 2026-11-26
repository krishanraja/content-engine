import type { VercelRequest, VercelResponse } from '@vercel/node'

// GET               the latest edition
// GET ?date=Y-M-D   that day's published edition (404 when there is none)
// GET ?archive=1    every published edition date, newest first
// One function serves all three, so the hub adds no serverless function.
const DAY = /^\d{4}-\d{2}-\d{2}$/
const first = (value: unknown) => Array.isArray(value) ? value[0] : value

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin','*')
  res.setHeader('Cache-Control','no-store')
  if (req.method !== 'GET') {
    res.setHeader('Allow','GET')
    return res.status(405).json({ ok: false, error: 'method_not_allowed' })
  }
  const date = first(req.query?.date)
  const archive = first(req.query?.archive)
  if (date !== undefined && (typeof date !== 'string' || !DAY.test(date)))
    return res.status(400).json({ ok: false, error: 'date_must_be_yyyy_mm_dd' })
  try {
    const store = await import('../../lib/hub/store.js')
    if (archive === '1') {
      const dates = await store.editionDates()
      res.setHeader('Cache-Control','public, max-age=60, s-maxage=300, stale-while-revalidate=3600')
      return res.status(200).json({ ok: true, dates })
    }
    if (date) {
      const snapshot = await store.byDate(date)
      if (!snapshot) return res.status(404).json({ ok: false, error: 'no_edition' })
      // A past edition only changes when the afternoon prices refresh it on its own day.
      res.setHeader('Cache-Control','public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')
      return res.status(200).json(snapshot)
    }
    const row = await store.latest()
    if (row) {
      res.setHeader('Cache-Control','public, max-age=60, s-maxage=300, stale-while-revalidate=3600')
      return res.status(200).json(row.snapshot)
    }
  } catch { console.warn('hub snapshot unavailable') }
  return res.status(503).json({ ok: false })
}
