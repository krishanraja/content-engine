// The line between an inspiration engine and a plagiarism engine.
//
// Taking inspiration from named creators only works if the MOVE transfers and
// the wording does not. Until this change that line was held entirely by a
// prompt asking a model not to paraphrase, which is a request, not a control.
// These are the properties that make it a control:
//
//   1. Both lanes measure it. The Tuesday scout and the Drive screenshot lane
//      both check overlap against the source before writing, and both count
//      their rejections rather than filtering quietly.
//   2. The bound is a constant, not a vibe, and it is generous enough that a
//      shared idiom does not trip it and tight enough that a lifted sentence
//      does.
//   3. Both lanes write the SAME move record, keyed by the post, or the two
//      lanes go on minting duplicate ideas from one post.
//   4. The record is form, never subject. Anti-echo, the same rule the arc
//      scorer and the edit ledger already hold.
//
//   npx tsx scripts/check-creator-moves.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  verbatimCheck, longestSharedRun, postHash, normaliseForHash, words,
  MAX_VERBATIM_RUN,
} from '../api/_creatorFingerprint.js'

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

const POST = 'Most founders think hiring is the bottleneck. It is not. The bottleneck is that nobody has written down how the work is actually done, so every new person relearns it from scratch.'

// ── 1. The gate catches a lift and clears an original ───────────────────────
{
  const lifted = 'The bottleneck is that nobody has written down how the work is actually done.'
  const verdict = verbatimCheck(lifted, POST)
  assert.equal(verdict.ok, false, 'a lifted sentence must not pass')
  assert.ok(verdict.run > MAX_VERBATIM_RUN)
  assert.match(verdict.phrase, /nobody has written down/, 'the gate must say which words it found, or nobody can check it')

  const original = 'Hiring is not the constraint. Undocumented process is, and every new starter pays for it twice.'
  assert.equal(verbatimCheck(original, POST).ok, true, 'an original take that shares a subject must pass')

  // Same claim, same shape, different words: this is exactly what the lane is
  // FOR, and a gate that rejects it would make the whole capability unusable.
  const sameMove = 'Everyone blames headcount. The real cost is that the method lives in one person head.'
  assert.equal(verbatimCheck(sameMove, POST).ok, true, 'borrowing the structure must stay allowed')
}

// ── 2. The bound is deliberate ──────────────────────────────────────────────
{
  assert.ok(MAX_VERBATIM_RUN >= 6 && MAX_VERBATIM_RUN <= 12,
    'below six the gate fires on ordinary sentences and gets raised until it means nothing; above twelve a whole lifted sentence walks through')

  // Grammar is not evidence of copying. Without this the gate fires on any two
  // texts written in English.
  const grammar = 'and it is not the same as it was in the way that we do it'
  assert.equal(verbatimCheck(grammar, `something ${grammar} something else`).ok, true,
    'a run of nothing but short words is grammar, not a lift')

  assert.equal(longestSharedRun('', POST).run, 0)
  assert.equal(longestSharedRun(POST, '').run, 0)
}

// ── 3. One post is one hash across both lanes ───────────────────────────────
{
  // A scrape keeps punctuation and tracking parameters; a transcription of a
  // screenshot does not. They must still agree, or the dedupe never fires.
  const scraped = `${POST} https://lnkd.in/abc?utm_source=share`
  const transcribed = POST.replace(/[.,]/g, '').replace(/\s+/g, '  ').toUpperCase()
  assert.equal(postHash(scraped), postHash(transcribed),
    'a scrape and a transcription of one post must hash the same, or the two lanes cannot dedupe')

  assert.notEqual(postHash(POST), postHash('A different post about something else entirely, at length.'))
  assert.match(postHash(POST), /^[a-f0-9]{64}$/)

  // The hash reads the top of the post, because a screenshot shows the top and
  // a scrape returns all of it.
  assert.equal(postHash(POST), postHash(`${POST} And then four more paragraphs the screenshot never showed.`.slice(0, POST.length)))

  assert.equal(normaliseForHash('Hello,   WORLD!! 🎉'), 'hello world')
  assert.deepEqual(words('One two.'), ['one', 'two'])
}

// ── 4. Both lanes actually call the gate and write the record ───────────────
{
  const scout = read('api/discover-creator-posts.ts')
  assert.match(scout, /verbatimCheck\(/, 'the scout must measure overlap before it writes')
  assert.match(scout, /bump\(dropped, 'verbatim_overlap'\)/, 'a lift must be a counted rejection, not a silent filter')
  assert.match(scout, /from\('creator_moves'\)/, 'the scout must write the move record')
  assert.match(scout, /onConflict: 'post_hash'/, 'the record is keyed by the post, so both lanes land on one row')
  assert.match(scout, /seen_via: 'scout'/)
  assert.match(scout, /creator_yield/, 'the scout must read the track record, or the outcome loop never closes')

  const drive = read('api/inspiration/drive-scan.ts')
  assert.match(drive, /verbatimCheck\(/, 'the screenshot lane must measure overlap too')
  assert.match(drive, /verbatim_rejects/, 'the screenshot lane must report what it refused')
  assert.match(drive, /seen_via: 'screenshot'/)
  assert.match(drive, /onConflict: 'post_hash'/)
}

// ── 5. Form, never subject ──────────────────────────────────────────────────
{
  // The record stores the hook, the structure and the proof device. It must not
  // grow a topic, a tag or a score keyed to what the post was about: that is
  // the echo the arc scorer and the edit ledger are both built to prevent.
  const migration = readFileSync(new URL('../../../supabase/migrations/20260911090000_creator_moves.sql', import.meta.url), 'utf8')
  assert.match(migration, /create table if not exists public\.creator_moves/)
  assert.match(migration, /create unique index if not exists creator_moves_post_hash_uq/, 'one post is one move')
  assert.match(migration, /revoke execute on function public\.creator_moves_track_outcome/, 'the outcome trigger must not also be an anon-callable RPC')
  assert.match(migration, /security_invoker = true/, 'creator_yield must read with the caller permissions')
  // Check the columns, not the prose. An earlier version of this grepped the
  // whole file and failed on its own comment explaining the rule.
  const columns = migration.slice(migration.indexOf('create table if not exists public.creator_moves'))
    .split(');')[0]
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
  assert.doesNotMatch(columns, /\btopic\b|\bsubject\b|\bkeywords?\b|\btags?\b|\bcategory\b/,
    'a move records form, never what the post was about')
  for (const column of ['post_hash', 'move', 'excerpt', 'seen_via', 'outcome', 'content_idea_id']) {
    assert.ok(columns.includes(column), `creator_moves is missing ${column}`)
  }

  // The yield view ranks by outcome, which is form travelling, not by anything
  // about the subject.
  assert.match(migration, /count\(\*\) filter \(where m\.outcome = 'advanced'\)/)
  assert.match(migration, /count\(\*\) filter \(where m\.outcome = 'buried'\)/)
}

// ── 6. The gate runs without a database ─────────────────────────────────────
{
  const imports = [...read('api/_creatorFingerprint.ts').matchAll(/^\s*import\s[^\n]*?from\s+'([^']+)'/gm)].map(m => m[1])
  assert.deepEqual(imports.filter(s => !s.startsWith('node:')), [],
    'the plagiarism gate must be checkable with no database, no network and no key')
}

console.log(`PASS  the move is a record both lanes share, and the ${MAX_VERBATIM_RUN}-word verbatim bound is measured, counted and testable`)
