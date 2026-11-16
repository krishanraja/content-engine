import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'
import { DRIVE_READONLY_SCOPE, googleAccessToken, googleConfigured } from '../_google.js'

// GET /api/inspiration/instagram-sheet: the bytes of his Instagram inspo sheet, for the lookalike step of the Sunday
// ideas run (scripts/post-pack/lookalike.py prepare).
//
// Krish, 2026-11-16: "we also need to build a lookalike model of stories that pull from the latest in [the Instagram
// inspo sheet] and then go and find similar if not better stories on the web." The sheet is one file in his Drive
// ("Instagram inspo.xlsx", tabs Themes and Posts), refreshed by content-watcher. The run in GitHub Actions has no Drive
// connector and no Google key, only the engine's operator key, so the engine reads the file for it.
//
// One file only: the id is a constant and nothing in the request can name another, so the route can never be turned
// into a reader of anything else in his Drive. The dashboard's cookie or the operator bearer, fail-closed
// (guardEngine). Read as the owner of his Drive first (GOOGLE_DRIVE_OWNER, read-only scope, as the board's Drive reads
// do), then as the service account itself (a file shared with it directly); a read that fails both ways answers 502
// with why, never an empty sheet. The answer is private and never cached.

export const INSTAGRAM_SHEET_ID = '1N3qftTy5aHiFjMkK_2c_O4rOvTAirw3N'
export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
/** Well under Vercel's response limit; the sheet was 1.8 MB on 16 Nov 2026. */
export const SHEET_MAX_BYTES = 4_000_000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET'])) return
  res.setHeader('Cache-Control', 'private, no-store')
  if (!googleConfigured()) {
    res.status(503).json({ ok: false, error: 'google_not_configured' })
    return
  }
  const owner = process.env.GOOGLE_DRIVE_OWNER || 'krish@mindmake.co'
  const why: string[] = []
  for (const who of [{ subject: owner }, { impersonate: false }] as const) {
    const token = await googleAccessToken([DRIVE_READONLY_SCOPE], { ...who, onError: (reason) => { why.push(reason.slice(0, 120)) } })
    if (!token) continue
    let r: Response
    try {
      r = await fetch(`https://www.googleapis.com/drive/v3/files/${INSTAGRAM_SHEET_ID}?alt=media&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } })
    } catch (e) {
      why.push(`drive unreachable: ${String((e as Error)?.message || e).slice(0, 120)}`)
      continue
    }
    if (!r.ok) {
      why.push(`drive answered ${r.status}`)
      continue
    }
    const bytes = Buffer.from(await r.arrayBuffer())
    if (bytes.length > SHEET_MAX_BYTES) {
      res.status(502).json({ ok: false, error: 'sheet_too_large', bytes: bytes.length })
      return
    }
    res.setHeader('Content-Type', XLSX_TYPE)
    res.setHeader('Content-Disposition', 'attachment; filename="instagram-inspo.xlsx"')
    res.setHeader('Content-Length', String(bytes.length))
    res.status(200).end(bytes)
    return
  }
  res.status(502).json({ ok: false, error: 'sheet_unreadable', why: why.slice(0, 4) })
}
