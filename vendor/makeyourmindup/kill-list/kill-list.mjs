#!/usr/bin/env node
/**
 * The deterministic gate.
 *
 * No model calls, no secrets, no network. It runs in seconds on everything and
 * it decides only what is decidable without judgement. Run it BEFORE any model
 * call: spending a draft-gate token on an em dash is waste.
 *
 *   node scripts/qa/kill-list.mjs <path> [...]
 *   node scripts/qa/kill-list.mjs --stdin < piece.md
 *   node scripts/qa/kill-list.mjs --formats formats.json drafts/*.md
 *
 * Exit 1 on any veto. Warnings never fail the run, because a crude heuristic
 * with an absolute veto produces false blocks and gets the gate switched off in
 * week two. The Fact Checker holds those two vetoes instead.
 *
 * A file whose front matter declares `kill_list_scope: canon` is scanned for
 * nothing but em dashes. Canon names retired brands in order to forbid them,
 * and a gate that blocks its own rulebook does not survive a deadline.
 *
 * A file declaring `kill_list_scope: paid_tier` may name CTRL, because CTRL
 * beta access in the paid tier is the one permitted connection. Every other
 * rule still runs on it, Mindmake included.
 *
 * A file declaring `kill_list_scope: legal_entity` may write the two exact
 * company names Mindmaker LLC and Mindmaker Ltd, which operate the site and are
 * not the retired publication name. Nothing else is relaxed: bare Mindmaker
 * still vetoes in that file, and so does every other rule.
 *
 * The day check needs live data and will not read a mandate out of this repo.
 * `venture_formats` in Mindmaker OS is the only truth for what runs when, so
 * pass a JSON file of {"<format_slug>": "<weekday>"} with --formats, or the
 * check is skipped and says so.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const RULES = JSON.parse(readFileSync(join(HERE, 'kill-list.v1.json'), 'utf8'))

const EM_DASH = '—'
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Front matter, if any, and the body that follows it. */
export function split(text) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  if (!m) return { front: {}, body: text, offset: 0 }
  const front = {}
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line)
    if (kv) front[kv[1]] = kv[2].trim()
  }
  return { front, body: text.slice(m[0].length), offset: m[0].length }
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length

/** Case-insensitive, whole-phrase where the phrase is wordlike. */
function findPhrase(body, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const wordy = /^[\w'./-]+$/.test(phrase.replace(/\s/g, ''))
  const re = new RegExp(wordy ? `\\b${escaped}\\b` : escaped, 'gi')
  return [...body.matchAll(re)]
}

/**
 * Every finding in one file. Pure, so the self-test can prove each rule fires
 * and, just as importantly, that each one stays quiet on clean copy.
 */
export function check(text, { path = '<stdin>', formats = null } = {}) {
  const { front, body: raw } = split(text)
  // The legal entity scope blanks out the exact company names, and only them,
  // keeping their length so every later line number still lines up.
  const entity = RULES.legal_entity_exemption
  const body = front.kill_list_scope === entity.value
    ? entity.allows_exact.reduce((b, name) => b.split(name).join(' '.repeat(name.length)), raw)
    : raw
  const findings = []
  const add = (level, id, line, says, sample) =>
    findings.push({ level, id, path, line, says, sample })

  // Em dashes apply to canon too. Everything else does not.
  for (const m of body.matchAll(new RegExp(EM_DASH, 'g'))) {
    add('veto', 'em_dash', lineOf(body, m.index), 'No em dashes anywhere, including code and on-screen text.', EM_DASH)
  }
  if (front.kill_list_scope === 'canon') {
    return { path, canon: true, findings }
  }

  const paid = RULES.paid_tier_exemption
  const allowed = front.kill_list_scope === paid.value ? paid.allows : {}

  for (const rule of RULES.vetoes) {
    if (rule.id === 'em_dash') continue
    if (rule.id === 'exclamation') {
      for (const m of body.matchAll(/!/g)) add('veto', rule.id, lineOf(body, m.index), rule.says, '!')
      continue
    }
    for (const phrase of rule.words || rule.patterns || []) {
      if ((allowed[rule.id] || []).includes(phrase)) continue
      for (const m of findPhrase(body, phrase)) {
        add('veto', rule.id, lineOf(body, m.index), rule.says, m[0])
      }
    }
  }

  // Warnings. Candidates for a human, never blocks.
  const NUMBER = /(?<![\w.])(?:[\dRAZ$£€]?[\d,]*\.?\d+\s?(?:%|bn|m|k|billion|million|thousand)?)(?![\w.])/gi
  const PRODUCER = /(according to|said|reported by|filing|survey|study|research|data from|per |produced by|\bby\b)/i
  // A date is not a load-bearing number and never needed a producer. Left in,
  // this rule fired on every dated line in the canon, which is how a gate
  // teaches people to scroll past its own warnings and stops being read.
  const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December'
  const undate = line => line
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(new RegExp(`\\b\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4}\\b`, 'gi'), ' ')
    .replace(new RegExp(`\\b(?:${MONTHS})\\s+\\d{1,2},?\\s+\\d{4}\\b`, 'gi'), ' ')
    .replace(new RegExp(`\\b(?:${MONTHS})\\s+\\d{4}\\b`, 'gi'), ' ')
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
  for (const rawLine of body.split('\n')) {
    if (!rawLine.trim() || /^\s*[#>|]/.test(rawLine)) continue
    const line = undate(rawLine)
    const numbers = [...line.matchAll(NUMBER)].filter(n => Number(String(n[0]).replace(/[^\d.]/g, '')) >= 10)
    if (numbers.length && !PRODUCER.test(line)) {
      add('warning', 'unattributed_number', lineOf(body, body.indexOf(rawLine)),
        RULES.warnings.find(w => w.id === 'unattributed_number').says, rawLine.trim().slice(0, 90))
    }
  }
  const arithmetic = /\b\d[\d,.]*\s*(?:x|times|multiplied by|divided by|per cent of|%\s*of)\s*\d/i.exec(body)
  if (arithmetic) {
    const before = body.slice(Math.max(0, arithmetic.index - 700), arithmetic.index)
    if (!/(estimate|estimates|bear that in mind|quality of the evidence|unverified|approximation|rough|we are doing arithmetic)/i.test(before)) {
      add('warning', 'evidence_before_arithmetic', lineOf(body, arithmetic.index),
        RULES.warnings.find(w => w.id === 'evidence_before_arithmetic').says, arithmetic[0])
    }
  }

  // The day check, only when live format data was handed in.
  if (front.format && front.date) {
    if (!formats) {
      add('note', 'day_check_skipped', 1,
        'Format and date declared but no --formats file given, so the day was not checked. venture_formats in Mindmaker OS is the only truth for what runs when.', front.format)
    } else {
      const want = formats[front.format]
      const got = DAYS[new Date(`${front.date}T12:00:00Z`).getUTCDay()]
      if (want && got && want !== got) {
        add('veto', 'wrong_day', 1, `${front.format} runs on ${want}, and this is dated a ${got}.`, front.date)
      }
    }
  }
  return { path, canon: false, findings }
}

async function main() {
  const argv = process.argv.slice(2)
  let formats = null
  const paths = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--formats') { formats = JSON.parse(readFileSync(argv[++i], 'utf8')); continue }
    paths.push(argv[i])
  }

  const inputs = []
  if (paths.includes('--stdin') || paths.length === 0) {
    const chunks = []
    for await (const c of process.stdin) chunks.push(c)
    inputs.push({ path: '<stdin>', text: Buffer.concat(chunks).toString('utf8') })
  }
  for (const p of paths.filter(p => p !== '--stdin')) {
    inputs.push({ path: p, text: readFileSync(p, 'utf8') })
  }

  let vetoes = 0, warnings = 0
  for (const input of inputs) {
    const { canon, findings } = check(input.text, { path: input.path, formats })
    for (const f of findings) {
      if (f.level === 'veto') vetoes++
      if (f.level === 'warning') warnings++
      console.log(`${f.level.toUpperCase()}  ${f.path}:${f.line}  ${f.id}  ${JSON.stringify(f.sample)}  ${f.says}`)
    }
    if (canon && !findings.length) console.log(`canon  ${input.path}  scanned for em dashes only`)
  }

  console.log(
    vetoes === 0
      ? `PASS  ${inputs.length} file(s), 0 vetoes, ${warnings} warning(s) for a human`
      : `${vetoes} VETO(ES), ${warnings} warning(s)`,
  )
  process.exit(vetoes ? 1 : 0)
}

if (process.argv[1] && process.argv[1].endsWith('kill-list.mjs')) main()
