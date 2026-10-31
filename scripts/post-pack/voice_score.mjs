#!/usr/bin/env node
// How close is this draft to the way Krish actually writes? A signal, never a gate.
//
// Krish, 2026-10-31: "I want one clear voice profile that I can use as an anchor and add to
// over time", then "yes do it all". The profile and its measure live once, in ai-harness
// (skills/krish-voice/references/voice-profile.md and evals/voice/); this script reads the
// measure from there at run time and keeps no copy of it.
//
//   node scripts/post-pack/voice_score.mjs DRAFT.md [--register long_form|linkedin_post|live_conversation] [--json]
//
// It prints a distance from 0 (as much like him as his typical piece) to 1, and the habits the
// draft falls short on. Treat it as a signal: the test behind it is 9 of 10 on held-out pieces,
// and its limits are in the profile. voice_check.py and ai_scan.py stay the gates.
//
// Where the measure comes from, first that answers:
//   1. AI_HARNESS_DIR, a local checkout of krishanraja/ai-harness (the home computers);
//   2. ai-harness main on GitHub (public), fetched each run.
// Exit 0 with a score; exit 2 when the draft or the measure cannot be read.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const RAW = 'https://raw.githubusercontent.com/krishanraja/ai-harness/main/evals/voice/'
const FILES = ['fingerprint.mjs', 'fingerprint.json']
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function fail(msg) { console.error(`voice_score: ${msg}`); process.exit(2) }

function fetchText(url) {
  // curl honours the proxy settings on every machine this runs on; Node's fetch does not.
  return execFileSync('curl', ['-fsSL', '--max-time', '30', url], { encoding: 'utf8' })
}

export function locateMeasure(env = process.env) {
  const local = env.AI_HARNESS_DIR && join(env.AI_HARNESS_DIR, 'evals', 'voice')
  if (local && FILES.every(f => existsSync(join(local, f)))) return { dir: local, source: `local ${local}` }
  const dir = join(ROOT, '.cache', 'voice-fingerprint')
  mkdirSync(dir, { recursive: true })
  for (const f of FILES) writeFileSync(join(dir, f), fetchText(RAW + f))
  return { dir, source: 'ai-harness main' }
}

export function stripMarkdown(md) {
  return md
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>]/g, '')
}

const NAMES = {
  short_sentence_share: 'too few short sentences',
  sentence_words_spread: 'sentence lengths too even',
  contractions_per_1k: 'too few contractions',
  you_per_1k: 'talks to the reader too little',
  spaced_hyphen_per_1k: 'no spaced-hyphen asides',
  parentheses_per_1k: 'no bracketed asides',
  formal_connectives_per_1k: 'formal connectives (moreover, however, therefore)',
  ai_tells_per_1k: 'model phrasing',
}

async function main(argv) {
  const path = argv.find(a => !a.startsWith('--'))
  if (!path) fail('usage: voice_score.mjs DRAFT.md [--register long_form] [--json]')
  const ri = argv.indexOf('--register')
  const register = ri >= 0 ? argv[ri + 1] : 'long_form'
  let text
  try { text = stripMarkdown(readFileSync(path, 'utf8')) } catch { fail(`cannot read ${path}`) }
  let where
  try { where = locateMeasure() } catch (e) { fail(`cannot read the measure from ai-harness: ${e.message}`) }
  const mod = await import(pathToFileURL(join(where.dir, 'fingerprint.mjs')).href)
  const fp = JSON.parse(readFileSync(join(where.dir, 'fingerprint.json'), 'utf8'))
  const result = mod.score(text, fp, register)
  if (argv.includes('--json')) { console.log(JSON.stringify({ ...result, source: where.source }, null, 2)); return }
  console.log(`voice distance ${result.distance} (0 = his typical ${register} piece, 1 = far from it; a signal, not a gate)`)
  const short = Object.entries(result.parts).filter(([, v]) => v >= 0.5).sort((a, b) => b[1] - a[1])
  for (const [k, v] of short) console.log(`  ${NAMES[k] || k}: ${v}`)
  if (!short.length) console.log('  no habit far from his')
  console.log(`measure: ${where.source}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2))
