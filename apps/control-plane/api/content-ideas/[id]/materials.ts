import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { supabase } from '../../_supabase.js'
import { MaterialsFull, pathId, readMaterials, withMaterial, type Material } from '../../_content.js'
import { guardEngine } from '../../_auth.js'
import { operatorAttribution } from '../../_editEvents.js'
import { StoreError, addToWorkingSet, listing, removeFromWorkingSet, type StoreDb } from '../../_pieceStore.js'

// /api/content-ideas/:id/materials
//   GET    — list the background materials attached to a piece.
//   POST   — attach one. body: { kind:'paste'|'link'|'file', title?, content?, url? }
//   DELETE — ?materialId=... remove one.
//
// Materials live on content_ideas.meta.materials[] (jsonb). This is the fix for
// the "corpus gets lost" problem: the research you paste/link to a piece is now
// stored durably, surfaced in the composer, used to ground Cleo's writing, and
// folded into the Google Doc on Save Draft.
//
// Since 2026-11-11 meta.materials is the working set the writers ground on, and the
// piece materials store is where nothing is ever lost (api/_pieceStore.ts): every
// change to meta.materials is filed there by a database trigger in the same write,
// a DELETE here takes a material off the working set only (the store keeps it,
// archive only), and both writes are guarded on the row's updated_at, so a write
// landing in between (a making record, another session) is read again, never
// overwritten. GET also carries `store`: everything on record for the piece, its
// day and its week (GET /api/content-ideas/store?piece=<id> has the whole listing).

const MAX_CONTENT = 400_000 // ~400KB of corpus per material is plenty

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET', 'POST', 'DELETE'])) return

  const id = pathId(req)
  if (!id) return res.status(400).json({ ok: false, error: 'id required' })

  const { data: idea, error } = await supabase
    .from('content_ideas').select('id,meta').eq('id', id).single()
  if (error || !idea) return res.status(404).json({ ok: false, error: 'idea not found' })

  const meta = (idea.meta || {}) as any
  const materials = readMaterials(meta)

  if (req.method === 'GET') {
    const store = await listing(supabase as unknown as StoreDb, { piece_id: String(id).toLowerCase() }).catch(() => null)
    return res.status(200).json({ ok: true, materials, store: store ? store.materials : null })
  }

  if (req.method === 'POST') {
    const b = (req.body || {}) as Partial<Material>
    const kind = b.kind === 'link' || b.kind === 'file' ? b.kind : 'paste'
    const content = typeof b.content === 'string' ? b.content.slice(0, MAX_CONTENT) : ''
    const url = typeof b.url === 'string' ? b.url.trim().slice(0, 2000) : ''
    // A verbatim excerpt is pasted text that is the source's own words, with
    // the page it came from. The fact gate trusts it further than a summary.
    const verbatim = b.verbatim === true && kind === 'paste' && /^https?:\/\//.test(url)
    if (b.verbatim === true && !verbatim) return res.status(400).json({ ok: false, error: 'a verbatim excerpt is pasted text with the url it was copied from' })
    if (kind === 'link' && !url) return res.status(400).json({ ok: false, error: 'url required for a link' })
    if (kind !== 'link' && !content.trim()) return res.status(400).json({ ok: false, error: 'content required' })

    const title = (typeof b.title === 'string' && b.title.trim())
      ? b.title.trim().slice(0, 200)
      : kind === 'link'
        ? hostnameOf(url)
        : firstHeadingOrLine(content)

    // Who added it decides how the writer is told about it (materialsContext).
    // The browser cookie is Krish's hand; the operator bearer is an agent
    // unless it is relaying something Krish supplied, with decided_by: 'Krish'.
    const who = operatorAttribution(req.headers.authorization, req.body)
    const material: Material = {
      by: who ? who.actor : 'Krish',
      id: randomUUID(),
      kind,
      title,
      content: kind === 'link' ? null : content,
      url: kind === 'link' || verbatim ? url : null,
      ...(verbatim ? { verbatim: true } : {}),
      bytes: kind === 'link' ? url.length : content.length,
      at: new Date().toISOString(),
    }
    try {
      withMaterial(materials, material)
    } catch (e) {
      if (e instanceof MaterialsFull) return res.status(409).json({ ok: false, error: e.message })
      throw e
    }
    let added: Awaited<ReturnType<typeof addToWorkingSet>>
    try { added = await addToWorkingSet(supabase as unknown as StoreDb, id, material) } catch (e) {
      if (e instanceof StoreError) return res.status(e.status).json({ ok: false, error: e.message })
      throw e
    }
    if (added.ok === false) return res.status(added.reason === 'busy' ? 409 : 503).json({ ok: false, error: added.reason === 'busy' ? 'piece_busy: send it again' : 'materials could not be saved' })
    return res.status(200).json({ ok: true, material, materials: added.materials })
  }

  if (req.method === 'DELETE') {
    const mid = Array.isArray(req.query.materialId) ? req.query.materialId[0] : req.query.materialId
    if (!mid) return res.status(400).json({ ok: false, error: 'materialId required' })
    let removed: Awaited<ReturnType<typeof removeFromWorkingSet>>
    try { removed = await removeFromWorkingSet(supabase as unknown as StoreDb, id, String(mid)) } catch (e) {
      if (e instanceof StoreError) return res.status(e.status).json({ ok: false, error: e.message })
      throw e
    }
    if (removed.ok === false) return res.status(removed.reason === 'busy' ? 409 : 503).json({ ok: false, error: removed.reason === 'busy' ? 'piece_busy: send it again' : 'materials could not be saved' })
    // Off the working set only: the piece materials store keeps it (archive it there to hide it).
    return res.status(200).json({ ok: true, materials: removed.materials, kept_in_store: true })
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}

function hostnameOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u.slice(0, 60) }
}
function firstHeadingOrLine(s: string): string {
  const line = s.split('\n').map(x => x.replace(/^#+\s*/, '').trim()).find(Boolean) || 'Pasted material'
  return line.slice(0, 120)
}
