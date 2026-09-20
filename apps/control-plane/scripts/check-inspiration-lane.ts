// The screenshot lane's invariants.
//
// This lane spends money unattended on the most expensive call the engine
// makes, and it is the front door Krish actually uses: he screenshots something
// on his phone and expects an idea. Five properties, each of which the n8n
// version got wrong at least once and each of which is invisible until it costs
// something:
//
//   1. The story is the identity, not the file. source_url must never be the
//      Drive link, or one post screenshotted twice is two ideas and the unique
//      index that exists to stop that never fires.
//   2. A transient failure comes back; a permanent one does not. Writing a
//      failed download to the ledger as processed makes it permanent.
//   3. The budget defers, it does not drop. A file cut for size must be named
//      in the response, or it is invisible until it happens to fit.
//   4. The floors are the ones Krish's rejections taught. The evidence floor,
//      the novelty floor, and the paraphrase rejection are carried verbatim.
//   5. The decisions run with no Drive, no model and no database, or they are
//      only ever checked in production.
//
//   npx tsx scripts/check-inspiration-lane.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  toCandidates, selectWithinBudget, storyUrl, parseSeedArray, filterSeeds,
  normaliseHandle, handleKey, creatorMatches, artifactKey, READABLE_MIMES, TRANSIENT_SKIPS,
  MAX_DOWNLOAD_ATTEMPTS, BLACKLISTED_FRAMINGS,
  ARTIFACT_INPUT_KINDS, ARTIFACT_STATUSES, ARTIFACT_SCOPES, artifactInputKind,
} from '../api/inspiration/_scan.js'
import { buildSystemPrompt, buildUserContent } from '../api/inspiration/_prompt.js'

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

// ── 1. The story is the identity ────────────────────────────────────────────
{
  const hash = 'a'.repeat(64)
  assert.equal(storyUrl('https://www.linkedin.com/posts/someone_abc-123', hash), 'https://www.linkedin.com/posts/someone_abc-123')
  // The two URLs that identify the COPY rather than the story. Accepting either
  // is the exact bug this lane was built to remove.
  assert.equal(storyUrl('https://drive.google.com/file/d/xyz/view', hash), `screenshot:${hash}`)
  assert.equal(storyUrl('https://docs.google.com/document/d/xyz/edit', hash), `screenshot:${hash}`)
  assert.equal(storyUrl(null, hash), `screenshot:${hash}`)
  assert.equal(storyUrl('not a url', hash), `screenshot:${hash}`)
  // With neither a URL nor bytes there is no identity, and the caller must skip
  // rather than write a row that can never dedupe.
  assert.equal(storyUrl(null, null), '')

  const route = read('api/inspiration/drive-scan.ts')
  assert.match(route, /source_url: url/, 'the seed must be written with the story url')
  assert.doesNotMatch(route, /source_url:\s*driveUrl/, 'the Drive url must never become the seed identity')
}

// ── 2. A transient failure comes back ───────────────────────────────────────
{
  assert.ok(TRANSIENT_SKIPS.has('download_failed'), 'a failed download is transient: it is the one that must be retried')
  assert.ok(!TRANSIENT_SKIPS.has('unhandled_mime'), 'a file type we cannot read will not become readable')
  assert.ok(!TRANSIENT_SKIPS.has('empty_or_too_short'), 'an empty doc is not a transient failure')
  assert.ok(MAX_DOWNLOAD_ATTEMPTS >= 2 && MAX_DOWNLOAD_ATTEMPTS <= 10, 'retries must be bounded: forever is not a policy')

  const route = read('api/inspiration/drive-scan.ts')
  assert.match(route, /retry_after: transient && !exhausted/, 'only a transient, unexhausted failure may be scheduled to return')
  assert.match(route, /'download_failed', \(prior\?\.attempts \|\| 0\) \+ 1/, 'each retry must count, or the bound never bites')
}

// ── 3. The budget defers, it does not drop ──────────────────────────────────
{
  const big = (id: string, bytes: number) => ({
    id, name: `${id}.png`, mimeType: 'image/png', modifiedTime: '2026-09-01T00:00:00Z', size: String(bytes),
  })
  const { candidates } = toCandidates([big('a', 2_000_000), big('b', 2_000_000), big('c', 2_000_000)])
  const selection = selectWithinBudget({ candidates, settled: new Set(), maxImageBytes: 4_500_000, maxImages: 6 })
  assert.equal(selection.selected.length, 2, 'the byte budget must cut the third image')
  assert.equal(selection.deferred.length, 1)
  assert.equal(selection.deferred[0].name, 'c.png', 'a deferred file must be named, not counted')

  // Newest first: Drive lists by modifiedTime desc, so the freshest drop wins
  // the budget and the remainder is picked up next run.
  assert.equal(selection.selected[0].id, 'a')

  const route = read('api/inspiration/drive-scan.ts')
  assert.match(route, /deferred_files: selection\.deferred\.map/, 'the response must name what is waiting')
  // A quiet fortnight is the ordinary reason for zero once the folder is
  // shared. The first version of this message named only the unshared case and
  // read as a fault when the lane was simply not fed.
  //
  // It was then pinned as a LITERAL sentence. When the message was improved on
  // 2026-09-19 to split the two zeroes apart, this line failed on wording while
  // the behaviour it exists to protect got strictly better, and that alone kept
  // main red from 2026-09-19 until 2026-09-20. A guard tied to a sentence fails
  // every time the sentence improves, which teaches people to stop improving it
  // or to stop believing the guard. Both are worse than no guard.
  //
  // The invariant is structural now: the two zeroes must be distinguishable,
  // and a quiet folder must SAY it is quiet rather than offering a hedge the
  // reader has to choose a half of.
  assert.match(route, /inspiration_folder_unreachable/, 'an unreadable folder needs its own error, or a dead lane reads as a quiet one')
  assert.match(route, /Quiet, not broken/, 'a quiet window must say so plainly rather than reading as a misconfiguration')
  assert.match(route, /none modified in the last \$\{lookbackDays\} days/, 'the quiet message must name the window it looked at')
  // A deferred file must NOT be written to the ledger, or it never returns.
  assert.doesNotMatch(route, /markLedger\([^)]*deferred/, 'a deferred file must stay out of the ledger')
}

// ── 4. The ledger subtraction is the spend control ──────────────────────────
{
  const { candidates } = toCandidates([
    { id: 'x', name: 'x.png', mimeType: 'image/png', modifiedTime: '2026-09-01T00:00:00Z', size: '100' },
    { id: 'y', name: 'y.png', mimeType: 'image/png', modifiedTime: '2026-09-01T00:00:00Z', size: '100' },
  ])
  const seen = selectWithinBudget({ candidates, settled: new Set(['x:2026-09-01T00:00:00Z']) })
  assert.equal(seen.selected.length, 1, 'a file already read must never be sent again')
  assert.equal(seen.seen_before, 1)

  // The key carries modifiedTime, so an EDITED file legitimately re-enters.
  assert.equal(candidates[0].file_key, 'x:2026-09-01T00:00:00Z')

  // Anything the vision call cannot read is listed and left, never downloaded.
  const mixed = toCandidates([
    { id: 'v', name: 'clip.mov', mimeType: 'video/quicktime', modifiedTime: '', size: '9000000' },
  ])
  assert.equal(mixed.candidates.length, 0, 'a video must not enter the budget')
  assert.equal(mixed.unreadable, 1)
  assert.ok(READABLE_MIMES.has('application/pdf') && READABLE_MIMES.has('image/png'))
}

// ── 5. The floors Krish's rejections taught ─────────────────────────────────
{
  const base = {
    is_idea: true, idea: 'A long enough headline to pass', pillar_id: 'pillar:agentic_ops',
    brand_fit_score: 9, evidence_present: ['named entity: X'],
  }
  assert.equal(filterSeeds([base], 6).survivors.length, 1)
  assert.equal(filterSeeds([{ ...base, evidence_present: [] }], 6).reasons['no_evidence_listed'], 1, 'the evidence floor must hold')
  assert.equal(filterSeeds([{ ...base, brand_fit_score: 5 }], 6).reasons['below_min_fit'], 1)
  assert.equal(filterSeeds([{ ...base, pillar_id: undefined }], 6).reasons['no_pillar'], 1)
  assert.equal(filterSeeds([{ ...base, idea: 'too short' }], 6).reasons['title_too_short'], 1)
  assert.equal(filterSeeds([{ is_idea: false, rejection_reason: 'duplicate_angle' }], 6).reasons['duplicate_angle'], 1,
    'a duplicate angle must be counted as one, not lost in not_idea')
  assert.equal(filterSeeds([{ ...base, idea: '7 ways to ship faster with AI' }], 6).reasons['blacklisted_framing'], 1)
  assert.ok(BLACKLISTED_FRAMINGS.length >= 6, 'the framing blacklist must not be quietly trimmed')

  // A truncated response still carries whole objects; a run's reading is not
  // discarded because the model ran out of tokens mid-array.
  const truncated = '[{"idea":"one","is_idea":true},{"idea":"two","is_idea":true}'
  assert.equal(parseSeedArray(truncated).length, 2)
  assert.deepEqual(parseSeedArray('not json at all'), [])
}

// ── 6. The prompt still carries the bar ─────────────────────────────────────
{
  const system = buildSystemPrompt({
    brief: '', pillars: [{ id: 'pillar:x', name: 'X', anti_patterns: ['a'], evidence_required: ['b'] }],
    creators: [{ name: 'Someone', linkedin_slug: 'someone', why: 'sharp' }],
    recentAngles: ['a prior angle'], sourceYield: [], minBrandFit: 7,
    imageCount: 1, pdfCount: 0, docCount: 0,
  })
  assert.match(system, /Auto-reject below 7/, 'the configured floor must reach the model')
  assert.match(system, /EVIDENCE FLOOR/)
  assert.match(system, /ALREADY SAID/, 'the novelty floor is what stops the eleventh copy of one idea')
  assert.match(system, /rejection_reason="paraphrase"/, 'a creator move must never come back as a restatement of the post')
  assert.match(system, /NO em dashes/)
  assert.match(system, /do NOT return the Drive link/, 'the model must be told which url to read')
  assert.match(system, /a prior angle/, 'the angles already produced must be in the prompt, not just intended')

  // The attachment blocks the vision call needs, in the order that lets the
  // model attribute a seed to a file.
  const blocks = buildUserContent([], [{ name: 's.png', mime_type: 'image/png', base64: 'AA', url: 'u' }], [])
  assert.equal(blocks[0].type, 'text')
  assert.equal(blocks[1].type, 'image')
  assert.equal(blocks[2].type, 'text')
  assert.match(String(blocks[2].text), /s\.png/, 'every attachment must be followed by its filename')
}

// ── 7. Identity helpers ─────────────────────────────────────────────────────
{
  const h = 'ab'.repeat(32)
  assert.equal(artifactKey(h, 'image/png'), `inspiration/ab/${h}.png`)
  assert.equal(artifactKey(h, 'application/pdf'), `inspiration/ab/${h}.pdf`)
  for (const form of ['@KrishRaja', 'krishraja', 'in/krishraja', 'https://www.linkedin.com/in/krishraja/']) {
    assert.equal(normaliseHandle(form), 'krishraja', `${form} must resolve to one person`)
  }
  assert.equal(normaliseHandle(null), '')

  // The live registry's most-screenshotted creator has no linkedin_slug at all,
  // so the Tuesday scout can never reach him and a screenshot is the only way
  // he is ever seen. Matching on the slug alone left him at zero posts seen.
  const noSlug = { slug: 'aaron-levie', linkedin_slug: null, name: 'Aaron Levie' }
  assert.ok(creatorMatches(noSlug, { poster_name: 'Aaron Levie' }), 'a creator with no handle must still match on his name')
  assert.ok(creatorMatches(noSlug, { poster_handle: 'aaronlevie' }), 'a handle must match the slug it is spelled from')
  assert.ok(creatorMatches(noSlug, { poster_handle: '@AaronLevie' }))
  assert.ok(!creatorMatches(noSlug, { poster_name: 'Someone Else' }))
  // Two initials must not match half the registry.
  assert.ok(!creatorMatches({ slug: 'al', linkedin_slug: null, name: 'AL' }, { poster_handle: 'al' }), 'a very short key is not evidence')
  assert.equal(handleKey('Aaron Levie'), 'aaronlevie')
}

// ── 8. The decisions run without Drive, a model or a database ───────────────
{
  for (const rel of ['api/inspiration/_scan.ts', 'api/inspiration/_prompt.ts']) {
    const imports = [...read(rel).matchAll(/^\s*import\s[^\n]*?from\s+'([^']+)'/gm)].map(m => m[1])
    assert.deepEqual(imports.filter(s => !s.startsWith('node:')), [],
      `${rel} must import nothing but the node standard library, or CI can only check it where credentials happen to exist`)
  }
  // The route is the only place that spends. If the model call moves into the
  // pure half, the guard above stops meaning anything.
  assert.match(read('api/inspiration/drive-scan.ts'), /callClaudeBlocks/, 'the spend belongs to the route')
}

// ── 9. Privacy line ─────────────────────────────────────────────────────────
{
  // The artifact row carries a bounded extraction, never the model's whole
  // answer and never an unbounded transcription.
  const route = read('api/inspiration/drive-scan.ts')
  assert.match(route, /the_idea: String\(seed\.idea \|\| ''\)\.slice\(0, 300\)/, 'the artifact must store a bounded extraction')
  assert.doesNotMatch(route, /analysis:\s*\{\s*raw/, 'the raw model response must never be stored on the artifact')
  assert.match(route, /slice\(0, MAX_EXCERPT\)/, 'the seed excerpt must stay bounded')

  // The artifact store predates this lane and is shared with the capture route
  // that comes next, so the scan must dedupe on the table's own unique column
  // rather than inventing a second identity beside it.
  assert.match(route, /canonical_key: `drive:\$\{file\.hash\}`/, 'the artifact must be keyed by its content hash')
  assert.match(route, /onConflict: 'canonical_key'/, 'the same bytes saved twice must be one artifact')

  // The three CHECK-constrained columns. The first draft of this route used
  // 'screenshot', 'analyzed' and 'content', none of which the table allows, and
  // nothing here or in CI could have caught it: a live probe did. So the
  // permitted sets are pinned, and the values the route writes must be in them.
  assert.equal(artifactInputKind('image/png'), 'image')
  assert.equal(artifactInputKind('application/pdf'), 'file')
  assert.equal(artifactInputKind('text/plain'), 'text')
  for (const kind of ARTIFACT_INPUT_KINDS) assert.match(kind, /^[a-z]+$/)
  const status = route.match(/status: '([a-z_]+)'/)?.[1]
  const scope = route.match(/scope: '([a-z_]+)'/)?.[1]
  assert.ok(status && (ARTIFACT_STATUSES as readonly string[]).includes(status), `status '${status}' is not one the table allows`)
  assert.ok(scope && (ARTIFACT_SCOPES as readonly string[]).includes(scope), `scope '${scope}' is not one the table allows`)
}

console.log('PASS  the screenshot lane dedupes on the story, retries only what can recover, defers visibly, and keeps its floors')
