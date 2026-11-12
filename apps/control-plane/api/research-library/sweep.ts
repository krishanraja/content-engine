import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardCronRoute, operatorBearerAllowed } from '../_auth.js'
import { withContentRun } from '../_runs.js'
import { runMirror } from '../_researchLibraryGoogle.js'

// The research library's sweep, recorded in the run ledger as research_library_mirror (docs/DRIVE.md, "The research
// library"; api/_researchLibrary.ts has the rules).
//
//   GET  /api/research-library/sweep                      cron, hourly
//   POST /api/research-library/sweep [{ material }]        by hand, on the cron secret, his login or the engine key; with a
//                                                          material id (or ?material=), copies that one now
//
// Copies every research material in the piece store that has no copy in `makeyourmindup > 6 Research library` yet, and
// adds each one's row to the library's `00 Index`. It leaves a material younger than ten minutes to the write that filed
// it. In Drive it only adds: a folder, a file. It keeps the index to one row per material (Ruling, Krish, 2026-11-11):
// a later row for a material already listed is removed, bottom first, in one batchUpdate, the first row taking the live
// link when its own copy is binned or missing; never the header or a material's only row, and nothing when the read looks
// short or malformed. The ledger counts it as index_deduped (and index_repaired). It fails, so Control Center shows it,
// when the library cannot be reached, a copy failed, or the index could not be written or tidied; the store keeps every
// material either way and the next run tries again.
//
// One sweep at a time: every run holds the library's lease (engine_leases), so a second sweep started while one runs, by
// hand or on the hour, answers `skipped: already_running` with when that lease runs out, writes nothing, and is recorded
// as skipped. Without the lease (its migration not applied, the database down) it writes nothing and fails.

export const config = { maxDuration: 120 }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

async function handler(req: VercelRequest, res: VercelResponse) {
  // A session on the engine key may run it by hand (a backfill, a check); everything else is the cron guard's.
  if (!(req.method === 'POST' && operatorBearerAllowed(req)) && guardCronRoute(req, res)) return
  res.setHeader('Cache-Control', 'no-store')
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body as Record<string, unknown> : {}
  const raw = req.method === 'POST' ? String(body.material ?? (Array.isArray(req.query.material) ? req.query.material[0] : req.query.material) ?? '') : ''
  const material = raw.trim().toLowerCase()
  if (material && !UUID.test(material)) return res.status(400).json({ ok: false, error: 'invalid_material' })
  const report = await runMirror({ only: material ? [material] : undefined, budgetMs: 90_000 })
  // The ledger keeps counts, never payloads: the links stay in the answer only.
  return res.status(200).json({ ...report, failed: report.failed.slice(0, 20), copies: report.copies.filter(c => c.created).slice(0, 50) })
}

export default withContentRun('research_library_mirror', handler)
