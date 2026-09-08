import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guard } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { PURGE_ARCHIVE_BUCKET } from './_archive.js'

// Put back what the Monday purge took.
//
//   GET  /api/purge/restore                 list what can be restored
//   POST /api/purge/restore {"key": "..."}  put that export back
//
// The half that makes the export worth writing. An archive nobody can restore
// from is a backup in the sense that most backups are: untested until the day
// it matters.
//
// Restores are additive and idempotent: rows are re-inserted by their original
// id and a row that already exists is left alone. Running this twice is safe,
// and restoring a week where some rows were meanwhile recreated by hand does
// not clobber the new ones.

interface ArchivePayload {
  schema_version?: number
  week?: string
  table?: string
  row_count?: number
  rows?: unknown[]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, ['GET', 'POST'])) return

  if (req.method === 'GET') {
    const { data, error } = await supabase.storage.from(PURGE_ARCHIVE_BUCKET).list('purge', {
      limit: 100,
      sortBy: { column: 'name', order: 'desc' },
    })
    if (error) return res.status(500).json({ ok: false, error: 'list_failed', reason: error.message.slice(0, 200) })
    // The listing is of week folders; say so plainly rather than returning a
    // shape that looks like files and is not.
    return res.status(200).json({
      ok: true,
      weeks: (data || []).map(d => d.name),
      note: 'POST {"key":"purge/<week>/<timestamp>.json"} to restore one export. GET ?week=<week> to list its exports.',
    })
  }

  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>
  const key = typeof body.key === 'string' ? body.key : ''
  // Bound the key to the archive's own namespace. A restore that can name any
  // object in the bucket is a read primitive pointed at whatever else lands
  // there later.
  if (!/^purge\/[0-9]{4}-W?[0-9]{1,2}\/[0-9T:.Z-]+\.json$/.test(key)) {
    return res.status(400).json({ ok: false, error: 'key_must_name_a_purge_export' })
  }

  const { data: file, error: downloadError } = await supabase.storage.from(PURGE_ARCHIVE_BUCKET).download(key)
  if (downloadError || !file) {
    return res.status(404).json({ ok: false, error: 'export_not_found', reason: downloadError?.message?.slice(0, 200) })
  }

  let payload: ArchivePayload
  try {
    payload = JSON.parse(await file.text()) as ArchivePayload
  } catch {
    return res.status(422).json({ ok: false, error: 'export_unreadable' })
  }
  if (payload.table !== 'content_ideas' || !Array.isArray(payload.rows)) {
    return res.status(422).json({ ok: false, error: 'export_is_not_a_content_ideas_export' })
  }

  // ignoreDuplicates: a restore never overwrites a row that exists now. The
  // point is to recover what was lost, not to roll the table back over work
  // done since.
  const { data, error } = await supabase
    .from('content_ideas')
    .upsert(payload.rows as Record<string, unknown>[], { onConflict: 'id', ignoreDuplicates: true })
    .select('id')
  if (error) return res.status(500).json({ ok: false, error: 'restore_failed', reason: error.message.slice(0, 200) })

  const restored = (data || []).length
  return res.status(200).json({
    ok: true,
    key,
    week: payload.week ?? null,
    in_export: payload.rows.length,
    restored,
    already_present: payload.rows.length - restored,
  })
}
