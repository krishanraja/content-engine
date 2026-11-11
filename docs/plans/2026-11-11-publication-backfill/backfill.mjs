#!/usr/bin/env node
// One-off: write the reconciled YouTube addresses (backfill.json) onto each piece's making record.
//   node docs/plans/2026-11-11-publication-backfill/backfill.mjs          dry run: prints the SQL and what it would change
//   node docs/plans/2026-11-11-publication-backfill/backfill.mjs --apply  writes (Krish's yes first: a production write)
// Idempotent: a slot that already holds a URL is never touched, so a second run changes nothing. Uses the Supabase
// management API (the proxy adds the credential; no key in this file).
import { readFileSync } from 'node:fs'
const REF = 'gojpffsrxybbpbdzzrvs'
const plan = JSON.parse(readFileSync(new URL('./backfill.json', import.meta.url), 'utf8'))
const q = async (query, read_only = true) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, read_only }) })
  const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j)); return j
}
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`
const url = (u) => (u.kind === 'shorts' ? `https://www.youtube.com/shorts/${u.id}` : `https://www.youtube.com/watch?v=${u.id}`)
const stmts = plan.uploads.map((u) => {
  const path = `{making,channels,${u.kind}}`
  const add = JSON.stringify({ url: url(u), video_id: u.id, recorded_by: 'backfill 2026-11-11' })
  // The table's guard (trigger content_ideas_keep_newer_making) keeps the stored making record unless the incoming one
  // carries a newer making.updated_at, as every engine write does (makingStamp); so the stamp moves with the write.
  return `update content_ideas set meta = jsonb_set(jsonb_set(jsonb_set(jsonb_set(meta, '{making,channels}', coalesce(meta->'making'->'channels', '{}'::jsonb)), ${lit(path)}, coalesce(meta->'making'->'channels'->${lit(u.kind)}, '{}'::jsonb) || ${lit(add)}::jsonb), '{making,updated_at}', to_jsonb(to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))), '{making,by}', '"backfill 2026-11-11"'::jsonb) where id = ${lit(u.piece)} and meta->'making' is not null and coalesce(meta->'making'->'channels'->${lit(u.kind)}->>'url', '') = '' returning id`
})
const before = await q(`select id, meta->'making'->'channels'->'youtube'->>'url' yt, meta->'making'->'channels'->'shorts'->>'url' sh from content_ideas where id in (${[...new Set(plan.uploads.map((u) => lit(u.piece)))].join(',')})`)
const have = new Map(before.map((r) => [r.id, r]))
let would = 0, already = 0, conflict = 0
for (const u of plan.uploads) {
  const cur = have.get(u.piece)?.[u.kind === 'shorts' ? 'sh' : 'yt']
  const state = !have.has(u.piece) ? 'MISSING PIECE' : !cur ? 'write' : cur.includes(u.id) ? 'already recorded' : `CONFLICT (holds ${cur})`
  if (state === 'write') would++; else if (state === 'already recorded') already++; else conflict++
  console.log(u.kind.padEnd(7), u.id, '->', u.piece.slice(0, 8), '|', state)
}
console.log(`\n${plan.uploads.length} associations: ${would} to write, ${already} already recorded, ${conflict} conflicts; ${plan.exceptions.length} exceptions left unwritten`)
if (!process.argv.includes('--apply')) { console.log('dry run: nothing written'); process.exit(conflict ? 1 : 0) }
if (conflict) { console.error('refusing to apply with conflicts'); process.exit(1) }
for (const s of stmts) await q(s, false)
// Never trust the count of returned rows: read every slot back.
const after = new Map((await q(`select id, meta->'making'->'channels'->'youtube'->>'url' yt, meta->'making'->'channels'->'shorts'->>'url' sh from content_ideas where id in (${[...have.keys()].map(lit).join(',')})`)).map((r) => [r.id, r]))
const missing = plan.uploads.filter((u) => !String(after.get(u.piece)?.[u.kind === 'shorts' ? 'sh' : 'yt'] || '').includes(u.id))
console.log(`readback: ${plan.uploads.length - missing.length} of ${plan.uploads.length} associations on their pieces`)
if (missing.length) { console.error('missing after apply:', missing.map((u) => `${u.kind} ${u.id} -> ${u.piece}`)); process.exit(1) }
