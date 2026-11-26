import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin','*')
  res.setHeader('Cache-Control','no-store')
  if (req.method !== 'GET') {
    res.setHeader('Allow','GET')
    return res.status(405).json({ ok: false, error: 'method_not_allowed' })
  }
  try {
    const { latest } = await import('../../lib/hub/store.js')
    const row = await latest()
    if (row) {
      res.setHeader('Cache-Control','public, max-age=60, s-maxage=300, stale-while-revalidate=3600')
      return res.status(200).json(row.snapshot)
    }
  } catch { console.warn('hub snapshot unavailable') }
  return res.status(503).json({ ok: false })
}
