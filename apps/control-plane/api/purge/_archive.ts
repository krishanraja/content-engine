// A copy of every row the Monday purge is about to hard-delete.
//
// This is the only hard delete in the engine and it runs unattended, so until
// now "the purge took something it should not have" was unrecoverable. There is
// no undo in Postgres for a row that is gone and no backup granular enough to
// pick one week out of.
//
// The rule the caller enforces, and the reason this returns a result rather
// than throwing: if the export fails, nothing is deleted. A week of un-purged
// rows is untidy. A week of deleted rows with no copy is the failure this
// exists to prevent, and the two are not close in cost.

import { supabase } from '../_supabase.js'

/** Private bucket. Nothing here is public: the rows carry drafts, sources and
 *  judgements. Create it as private with no public policy. */
export const PURGE_ARCHIVE_BUCKET = 'content-engine-archive'

export interface ExportResult {
  ok: boolean
  key: string | null
  rows: number
  reason?: string
}

export function archiveKey(week: string, now = new Date()): string {
  // Week plus timestamp: a re-run in the same week must not overwrite the first
  // export, or a second purge silently destroys the copy that mattered.
  return `purge/${week}/${now.toISOString().replace(/[:.]/g, '-')}.json`
}

export async function exportBeforeDelete(
  week: string,
  rows: unknown[],
  now = new Date(),
): Promise<ExportResult> {
  if (!rows.length) return { ok: true, key: null, rows: 0 }

  const key = archiveKey(week, now)
  const payload = JSON.stringify({
    schema_version: 1,
    exported_at: now.toISOString(),
    week,
    table: 'content_ideas',
    reason: 'monday purge, expired news-horizon rows',
    restore: 'POST /api/purge/restore with {"key": "<this key>"}',
    row_count: rows.length,
    rows,
  }, null, 2)

  try {
    const { error } = await supabase.storage
      .from(PURGE_ARCHIVE_BUCKET)
      .upload(key, payload, { contentType: 'application/json', upsert: false })
    if (error) return { ok: false, key: null, rows: rows.length, reason: error.message.slice(0, 200) }
    return { ok: true, key, rows: rows.length }
  } catch (e) {
    return { ok: false, key: null, rows: rows.length, reason: (e as Error)?.message?.slice(0, 200) || 'upload threw' }
  }
}
