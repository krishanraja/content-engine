#!/usr/bin/env node
// The moves library: every move folder has a valid move.json and the code it names; index.json is current; every
// engine device it lists exists in config/ve/devices.json.
//   node lab/moves/check.mjs          check (exit 1 on a problem)
//   node lab/moves/check.mjs --write  rewrite index.json from the move folders and the engine's devices
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..')
const SAYS = ['number', 'contrast', 'list', 'quote', 'evidence', 'process', 'timeline', 'before-after', 'person', 'place']
const NEEDS = ['text', 'number', 'screenshot', 'footage', 'face']
const problems = []
const moves = readdirSync(HERE, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
const entries = []
for (const id of moves) {
  const f = join(HERE, id, 'move.json')
  if (!existsSync(f)) { problems.push(`${id}: no move.json`); continue }
  const m = JSON.parse(readFileSync(f, 'utf8'))
  if (m.id !== id) problems.push(`${id}: id is ${m.id}`)
  for (const k of ['what', 'says', 'needs', 'energy', 'engine', 'code', 'entry', 'from', 'proven_by']) if (!m[k]) problems.push(`${id}: missing ${k}`)
  for (const s of m.says ?? []) if (!SAYS.includes(s)) problems.push(`${id}: says "${s}" is not one of ${SAYS.join(', ')}`)
  for (const s of m.needs ?? []) if (!NEEDS.includes(s)) problems.push(`${id}: needs "${s}" is not one of ${NEEDS.join(', ')}`)
  if (!['canvas', 'three'].includes(m.engine)) problems.push(`${id}: engine ${m.engine}`)
  const code = join(ROOT, m.code ?? '')
  if (!existsSync(code)) problems.push(`${id}: ${m.code} does not exist`)
  else if (!new RegExp(`export function ${m.entry}\\b`).test(readFileSync(code, 'utf8'))) problems.push(`${id}: ${m.code} does not export ${m.entry}`)
  entries.push({ id, kind: 'lab', what: m.what, says: m.says, needs: m.needs, energy: m.energy, engine: m.engine, code: m.code })
}
const dv = JSON.parse(readFileSync(join(ROOT, 'config/ve/devices.json'), 'utf8'))
const devices = dv.devices ?? dv
for (const id of Object.keys(devices).sort()) entries.push({ id, kind: 'engine-device', what: 'verbs: ' + (devices[id].verbs ?? []).join(', '), where: 'config/ve/devices.json', note: 'drawn by the ve renderer (frozen during a piece); not yet a lab move' })
const index = { _about: 'Every move there is: the lab moves (lab/moves/<id>) any style can call, and the ve engine devices, listed so there is one inventory. Written by node lab/moves/check.mjs --write.', moves: entries }
const want = JSON.stringify(index, null, 1) + '\n'
if (process.argv.includes('--write')) writeFileSync(join(HERE, 'index.json'), want)
else if (!existsSync(join(HERE, 'index.json')) || readFileSync(join(HERE, 'index.json'), 'utf8') !== want) problems.push('index.json is not current: run node lab/moves/check.mjs --write')
for (const p of problems) console.error('moves:', p)
console.log(`moves: ${moves.length} lab moves, ${Object.keys(devices).length} engine devices, ${problems.length} problems`)
process.exit(problems.length ? 1 : 0)
