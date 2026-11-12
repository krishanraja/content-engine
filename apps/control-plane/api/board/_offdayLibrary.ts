import type { SupabaseClient } from '@supabase/supabase-js'
import { googleAccessToken } from '../_google.js'
import { RESEARCH_LIBRARY_INDEX_ID, placeOf, type StoredMaterial } from '../_researchLibrary.js'
import { libraryFixes, type LibraryFollower } from './_offdayItems.js'

// The research library follows a moved piece (docs/PUBLISH_BOARDS.md, "Moving an off-day item to any day"; Ruling,
// Krish, 2026-11-12: the move updates every place that names its day). The library's `00 Index` names each piece's
// research by its week, its day and its date (placeOf in api/_researchLibrary.ts, the same words the sweep writes).
// When a piece he records moves to another day, every index row that names it takes its new Week, Day and Piece cells,
// in one Sheets batchUpdate, under the library's one lease, so it never races the sweep. The copies in Drive are never
// renamed or moved: the library never does that, and each copy's description links the live board, which follows the
// row by itself. An off-day post with no piece has no research rows of its own, and nothing here touches its day's rows.

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'
const DAY_CELL: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }

export function libraryFollower(db: SupabaseClient, f: typeof fetch = fetch): LibraryFollower {
  return {
    async follow(pieceId) {
      const token = await googleAccessToken([DRIVE_SCOPE], { subject: process.env.GOOGLE_DRIVE_OWNER || 'krish@mindmake.co' }).catch(() => null)
      if (!token) return 'not_configured'
      const piece = await db.from('content_ideas').select('id,idea,scheduled_for,lane_slot').eq('id', pieceId).maybeSingle()
      if (piece.error || !piece.data) return 'failed'
      const p = piece.data as { id: string; idea: string | null; scheduled_for: string | null; lane_slot: string | null }
      const place = placeOf({ id: '', scope: '', piece_id: pieceId, week: null, day: null, material_key: '', version: 1, kind: 'research', role: null, title: '',
        note: null, sha256: '', bytes: 0, content_type: null, storage: 'text', text_sha256: null, object_key: null, added_by: '', added_at: new Date().toISOString(), archived_at: null } as StoredMaterial,
      { id: pieceId, idea: p.idea, scheduled_for: p.scheduled_for, series: p.lane_slot })
      const { storeLease } = await import('../_researchLibraryGoogle.js')
      const lease = await storeLease(db as never, 'write').take()
      if (!lease.ok) return 'held' in lease && lease.held ? 'busy' : 'failed'
      try {
        const headers = { Authorization: `Bearer ${token}` }
        const sheet = `${SHEETS}/${encodeURIComponent(RESEARCH_LIBRARY_INDEX_ID)}`
        const read = await f(`${sheet}/values/${encodeURIComponent('A:M')}?majorDimension=ROWS`, { headers })
        if (!read.ok) return 'failed'
        const j = await read.json() as { range?: string; values?: unknown[][] }
        const range = /^(?:'((?:[^']|'')+)'|([^!']+))!\$?[A-Z]+\$?(\d+)/.exec(String(j.range || ''))
        if (!range) return 'failed'
        const values = (Array.isArray(j.values) ? j.values : []).map(r => (Array.isArray(r) ? r.map(v => String(v ?? '')) : []))
        const fixes = libraryFixes(values, Number(range[3]), pieceId, [place.week, DAY_CELL[place.day] || place.day, place.slotName])
        if (!fixes.length) return values.some(r => String(r[11] || '').toLowerCase() === pieceId) ? 'already' : 'none'
        const title = range[1] !== undefined ? range[1].replace(/''/g, "'") : range[2]
        const meta = await f(`${sheet}?fields=${encodeURIComponent('sheets.properties(sheetId,title)')}`, { headers })
        const tabs = meta.ok ? ((await meta.json()) as { sheets?: Array<{ properties?: { sheetId?: number; title?: string } }> }).sheets || [] : []
        const tab = tabs.map(x => x.properties).find(t => t && t.title === title)
        if (!tab) return 'failed'
        const requests = fixes.map(x => ({ updateCells: {
          range: { sheetId: tab.sheetId ?? 0, startRowIndex: x.row - 1, endRowIndex: x.row, startColumnIndex: 0, endColumnIndex: 3 },
          rows: [{ values: x.cells.map(c => ({ userEnteredValue: { stringValue: c } })) }], fields: 'userEnteredValue',
        } }))
        const w = await f(`${sheet}:batchUpdate`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }) })
        return w.ok ? `updated:${fixes.length}` : 'failed'
      } finally {
        await lease.release().catch(() => {})
      }
    },
  }
}
