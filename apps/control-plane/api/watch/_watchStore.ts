import { supabase } from '../_supabase.js'
import type { ReadRow, WatchRequestRow, WatchStore } from './_watch.js'

// The WatchStore the routes use: content_watch_requests and content_reads through the service role.
// Every request update is conditional on the status and claim the caller read, so two home computers
// never both take or both report the same request.

const COLUMNS = 'id, url, url_key, platform, lane, note, status, attempts, claimed_by, claimed_at, requested_at, updated_at, media'

export const watchStore: WatchStore = {
  async claimable(staleBefore, limit) {
    const { data, error } = await supabase
      .from('content_watch_requests')
      .select(COLUMNS)
      .or(`status.eq.queued,and(status.in.(claimed,filed),claimed_at.lt.${staleBefore})`)
      .order('requested_at', { ascending: true })
      .limit(limit)
    if (error) throw new Error('watch_store_unavailable')
    return (data || []) as WatchRequestRow[]
  },
  async updateIf(id, was, patch) {
    let query = supabase.from('content_watch_requests').update(patch).eq('id', id).eq('status', was.status)
    query = was.claimed_at === null ? query.is('claimed_at', null) : query.eq('claimed_at', was.claimed_at)
    const { data, error } = await query.select(COLUMNS)
    if (error) throw new Error('watch_store_unavailable')
    return data && data.length === 1 ? data[0] as WatchRequestRow : null
  },
  async get(id) {
    const { data, error } = await supabase.from('content_watch_requests').select(COLUMNS).eq('id', id).maybeSingle()
    if (error) throw new Error('watch_store_unavailable')
    return (data as WatchRequestRow | null) ?? null
  },
  async readRevs(shas) {
    const out = new Map<string, { id: string; engine_rev: string; linked: boolean }>()
    if (!shas.length) return out
    const { data, error } = await supabase.from('content_reads').select('id, sha256, engine_rev, source_url').in('sha256', shas)
    if (error) throw new Error('watch_store_unavailable')
    for (const row of data || []) {
      out.set(row.sha256 as string, { id: row.id as string, engine_rev: row.engine_rev as string, linked: row.source_url != null })
    }
    return out
  },
  async upsertReads(rows: ReadRow[]) {
    const stamp = new Date().toISOString()
    const { data, error } = await supabase
      .from('content_reads')
      .upsert(rows.map(r => ({ ...r, updated_at: stamp })), { onConflict: 'sha256' })
      .select('id, sha256')
    if (error) throw new Error('watch_store_unavailable')
    const out = new Map<string, string>()
    for (const row of data || []) out.set(row.sha256 as string, row.id as string)
    return out
  },
}
