import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardCronRoute } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { withContentRun } from '../_runs.js'
import { loadConfig, callClaudeBlocks } from '../_content.js'
import { driveListFolder, driveDownloadFile, googleConfigured } from '../_google.js'
import { postHash, verbatimCheck } from '../_creatorFingerprint.js'
import { buildSystemPrompt, buildUserContent, type Pillar, type CreatorRow, type YieldRow, type ReadableDoc, type ReadableBinary } from './_prompt.js'
import {
  toCandidates, selectWithinBudget, parseSeedArray, filterSeeds,
  fileHash, artifactKey, storyUrl, handleKey, creatorMatches, artifactInputKind,
  TEXT_MIMES, IMAGE_MIMES, PDF_MIME, TRANSIENT_SKIPS,
  RETRY_AFTER_MINUTES, MAX_DOWNLOAD_ATTEMPTS,
  DEFAULT_LOOKBACK_DAYS, DEFAULT_MAX_IMAGES, DEFAULT_MAX_IMAGE_BYTES,
  type Candidate, type Seed,
} from './_scan.js'

// The screenshot lane, in the engine.
//
//   GET  /api/inspiration/drive-scan   cron, every two hours
//   POST /api/inspiration/drive-scan   "Scan now" from the Supply drawer
//
// Krish screenshots a LinkedIn post on his phone, drops it in a Drive folder,
// and expects an idea to be waiting. That worked twice a day in n8n. Three
// things it could not do, and this route does:
//
//   Run when he asks. Twice a day means a screenshot taken at 09:05 is invisible
//   until the evening. POST scans now.
//
//   Recognise the story rather than the file. The old lane set source_url to the
//   Drive link, so the same post screenshotted on two devices was two ideas.
//   The model is now asked to read the post's own URL out of the image, and the
//   content hash stands in when there is none.
//
//   Keep what it read. Every downloaded file becomes a row in
//   content_inspiration_artifacts with its bytes in a private bucket, so a card
//   can show the screenshot and a re-extraction never re-downloads.
//
// Failure posture: nothing here throws away work. A file that fails to download
// is scheduled for retry rather than marked processed; a file cut by the request
// budget is named in the response rather than silently dropped; a model call
// that returns unparseable JSON leaves the files unregistered so the next scan
// tries again.

const BUCKET = 'inspiration-artifacts'
const MAX_DOC_CHARS = 8000
const MAX_EXCERPT = 400

interface LedgerRow { file_key: string; skip_reason: string | null; retry_after: string | null; attempts: number | null }

/** A file the scan should not pick up again right now: it read fine, or it
 *  failed in a way that will not change, or its retry is not due yet. */
function settledKeys(rows: LedgerRow[], now: Date): Set<string> {
  const out = new Set<string>()
  for (const r of rows) {
    if (!r.skip_reason) { out.add(r.file_key); continue }
    if (!TRANSIENT_SKIPS.has(r.skip_reason)) { out.add(r.file_key); continue }
    if ((r.attempts || 0) >= MAX_DOWNLOAD_ATTEMPTS) { out.add(r.file_key); continue }
    if (r.retry_after && new Date(r.retry_after) > now) out.add(r.file_key)
  }
  return out
}

async function markLedger(c: Candidate, skipReason: string | null, attempts: number, runRef: string) {
  const transient = skipReason !== null && TRANSIENT_SKIPS.has(skipReason)
  const exhausted = attempts >= MAX_DOWNLOAD_ATTEMPTS
  await supabase.from('inspiration_drive_files').upsert({
    file_key: c.file_key,
    file_id: c.id,
    name: c.name,
    mime_type: c.mime_type,
    size_bytes: c.size_bytes,
    modified_at: c.modified || null,
    run_ref: runRef,
    processed_at: new Date().toISOString(),
    skip_reason: skipReason,
    attempts,
    // Null means settled. A transient failure that has not run out of attempts
    // is the only case that comes back.
    retry_after: transient && !exhausted
      ? new Date(Date.now() + RETRY_AFTER_MINUTES * 60_000).toISOString()
      : null,
  }, { onConflict: 'file_key' })
}

interface ReadFile { hash: string; candidate: Candidate; mime: string; bytes: number }

/** Keep what was read, in the artifact store that already existed.
 *
 *  canonical_key is the table's own unique column, so keying it by the content
 *  hash means the same screenshot saved twice is one artifact rather than a
 *  second copy of the bytes. analysis carries a bounded extraction: the poster,
 *  the url the model claims it read, and one line each of idea and reason.
 *  Never the whole response, and never an unbounded transcription. */
async function writeArtifact(file: ReadFile, seed: Seed, storyRef: string, model: string, ideaId: string | null) {
  await supabase.from('content_inspiration_artifacts').upsert({
    canonical_key: `drive:${file.hash}`,
    // These three are CHECK-constrained on the table. The first draft of this
    // route used 'screenshot', 'analyzed' and 'content', none of which are
    // allowed values, and every write would have failed in production only. The
    // permitted sets are pinned in _scan.ts against the live constraints.
    input_kind: artifactInputKind(file.mime),
    status: 'complete',
    scope: 'everything',
    source_url: storyRef,
    source_label: file.candidate.name,
    storage_bucket: BUCKET,
    storage_path: artifactKey(file.hash, file.mime),
    content_hash: file.hash,
    source_meta: {
      drive_file_id: file.candidate.id,
      file_key: file.candidate.file_key,
      mime: file.mime,
      bytes: file.bytes,
      modified_at: file.candidate.modified || null,
    },
    analysis: {
      model,
      poster_name: seed.poster_name ?? null,
      poster_handle: seed.poster_handle ?? null,
      source_url_if_visible: typeof seed.source_url === 'string' ? seed.source_url : null,
      the_idea: String(seed.idea || '').slice(0, 300),
      why_saved: String(seed.thesis || '').slice(0, 300),
    },
    analyzed_at: new Date().toISOString(),
    content_idea_id: ideaId,
  }, { onConflict: 'canonical_key' })
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardCronRoute(req, res)) return

  const now = new Date()
  const runRef = `drive-scan-${now.toISOString().slice(0, 16)}`

  if (!googleConfigured()) {
    return res.status(200).json({ ok: true, skipped: 'google_service_account_not_configured' })
  }

  const cfg = await loadConfig([
    'cleo_inspiration_folder_id',
    'cleo_inspiration_drive_lookback_days',
    'cleo_inspiration_max_images_per_run',
    'cleo_inspiration_max_image_bytes',
    'cleo_inspiration_min_brand_fit',
  ])
  const folderId = String(cfg['cleo_inspiration_folder_id'] || '').trim()
  if (!folderId) return res.status(200).json({ ok: true, skipped: 'no_inspiration_folder_configured' })

  const lookbackDays = Number(cfg['cleo_inspiration_drive_lookback_days']) || DEFAULT_LOOKBACK_DAYS
  const maxImages = Number(cfg['cleo_inspiration_max_images_per_run']) || DEFAULT_MAX_IMAGES
  const maxImageBytes = Number(cfg['cleo_inspiration_max_image_bytes']) || DEFAULT_MAX_IMAGE_BYTES
  const minBrandFit = Number(cfg['cleo_inspiration_min_brand_fit']) || 6

  const listing = await driveListFolder(folderId, lookbackDays)
  if (!listing.ok) return res.status(200).json({ ok: false, error: 'drive_list_failed', reason: listing.reason })

  const { candidates, listed, unreadable } = toCandidates(listing.files)
  if (!candidates.length) {
    // A zero here is usually the folder not being shared with the service
    // account, which lists clean rather than erroring. Say the difference.
    return res.status(200).json({
      ok: true,
      skipped: listed === 0
        ? 'folder_listed_nothing: check the folder is shared with GOOGLE_SERVICE_ACCOUNT_EMAIL'
        : 'nothing_readable_in_folder',
      listed, unreadable,
    })
  }

  const { data: ledgerRows } = await supabase
    .from('inspiration_drive_files')
    .select('file_key, skip_reason, retry_after, attempts')
    .in('file_key', candidates.map(c => c.file_key))

  const priorRows = (ledgerRows || []) as LedgerRow[]
  const selection = selectWithinBudget({
    candidates,
    settled: settledKeys(priorRows, now),
    maxImages,
    maxImageBytes,
  })

  if (!selection.selected.length) {
    return res.status(200).json({
      ok: true,
      skipped: 'nothing_new_to_read',
      listed, unreadable,
      seen_before: selection.seen_before,
      deferred: selection.deferred.length,
      deferred_files: selection.deferred.map(d => d.name),
    })
  }

  // ── Download ──────────────────────────────────────────────────────────────
  const docs: ReadableDoc[] = []
  const images: ReadableBinary[] = []
  const pdfs: ReadableBinary[] = []
  const readOk: Candidate[] = []
  const fileByName = new Map<string, ReadFile>()
  let downloadFailed = 0

  for (const c of selection.selected) {
    const bytes = await driveDownloadFile(c.id, c.mime_type)
    if (!bytes) {
      const prior = priorRows.find(r => r.file_key === c.file_key)
      await markLedger(c, 'download_failed', (prior?.attempts || 0) + 1, runRef)
      downloadFailed++
      continue
    }
    const hash = fileHash(bytes)
    const driveUrl = `https://drive.google.com/file/d/${c.id}/view`

    if (TEXT_MIMES.has(c.mime_type)) {
      const body = Buffer.from(bytes).toString('utf-8').replace(/\u0000/g, '').slice(0, MAX_DOC_CHARS)
      if (body.length < 80) { await markLedger(c, 'empty_or_too_short', 0, runRef); continue }
      docs.push({ name: c.name, body, url: driveUrl })
      readOk.push(c)
      fileByName.set(c.name, { hash, candidate: c, mime: c.mime_type, bytes: bytes.length })
      continue
    }

    if (!IMAGE_MIMES.has(c.mime_type) && c.mime_type !== PDF_MIME) {
      await markLedger(c, 'unhandled_mime', 0, runRef)
      continue
    }

    const entry: ReadableBinary = { name: c.name, mime_type: c.mime_type, base64: Buffer.from(bytes).toString('base64'), url: driveUrl }
    if (c.mime_type === PDF_MIME) pdfs.push(entry)
    else images.push(entry)
    readOk.push(c)
    fileByName.set(c.name, { hash, candidate: c, mime: c.mime_type, bytes: bytes.length })

    // The bytes are kept before the model is asked anything, so a run that
    // fails at the model still leaves the artifact behind.
    await supabase.storage.from(BUCKET).upload(artifactKey(hash, c.mime_type), Buffer.from(bytes), {
      contentType: c.mime_type,
      upsert: false,
    })
  }

  if (!docs.length && !images.length && !pdfs.length) {
    return res.status(200).json({
      ok: true,
      skipped: downloadFailed ? 'every_selected_file_failed_to_download' : 'nothing_readable_downloaded',
      listed, unreadable, selected: selection.selected.length, download_failed: downloadFailed,
    })
  }

  // ── Read ──────────────────────────────────────────────────────────────────
  const [pillarsRes, briefRes, creatorsRes, anglesRes, yieldRes] = await Promise.all([
    supabase.from('content_pillars').select('id,name,description,good_looks_like,anti_patterns,evidence_required').eq('active', true).order('id'),
    supabase.from('agents').select('brief_content').eq('id', 'cleo').maybeSingle(),
    supabase.from('content_creators').select('id,slug,name,linkedin_slug,why,posts_seen').eq('active', true).order('name'),
    supabase.from('content_ideas').select('idea').gte('created_at', new Date(Date.now() - 60 * 86_400_000).toISOString()).order('created_at', { ascending: false }).limit(120),
    supabase.from('newsletter_source_yield').select('newsletter_key,seeds,advanced,buried,recurrences').limit(60),
  ])

  const creators = (creatorsRes.data || []) as Array<CreatorRow & { id: string; slug: string | null; posts_seen: number | null }>
  const system = buildSystemPrompt({
    brief: String((briefRes.data as Record<string, unknown> | null)?.brief_content || ''),
    pillars: (pillarsRes.data || []) as unknown as Pillar[],
    creators: creators.map(c => ({ name: c.name, linkedin_slug: c.linkedin_slug, why: c.why })),
    recentAngles: (anglesRes.data || []).map(r => String((r as { idea?: string }).idea || '').slice(0, 120)).filter(Boolean),
    sourceYield: ((yieldRes.data || []) as unknown as YieldRow[]).filter(r => r.newsletter_key && r.newsletter_key !== 'unlabelled'),
    minBrandFit,
    imageCount: images.length,
    pdfCount: pdfs.length,
    docCount: docs.length,
  })

  let raw = ''
  let model = ''
  try {
    const answer = await callClaudeBlocks(system, buildUserContent(docs, images, pdfs), { agent: 'inspiration_scan', maxTokens: 8000 })
    raw = answer.text
    model = answer.model
  } catch (e) {
    // The files stay unregistered on purpose: an API failure is not evidence
    // that this screenshot holds nothing.
    return res.status(200).json({ ok: false, error: 'extraction_failed', reason: (e as Error)?.message?.slice(0, 200) })
  }

  const parsed = parseSeedArray(raw)
  const { survivors, rejected, reasons, raw_count } = filterSeeds(parsed, minBrandFit)

  // ── Keep ──────────────────────────────────────────────────────────────────
  let inserted = 0
  let recurrence = 0
  const creatorHits: string[] = []
  // Counted rather than hidden: a lane that keeps producing near-copies is
  // something Krish should see, not something the engine quietly filters.
  let verbatimRejects = 0

  for (const seed of survivors as Seed[]) {
    const file = typeof seed.image_source === 'string' ? fileByName.get(seed.image_source) : undefined
    const hash = file?.hash || null
    const url = storyUrl(seed.source_url, hash)
    if (!url) { reasons['no_identifiable_source'] = (reasons['no_identifiable_source'] || 0) + 1; continue }

    const { data: rpc } = await supabase.rpc('upsert_inspiration_seed', {
      p: {
        idea: seed.idea,
        thesis: seed.thesis,
        pillar_id: seed.pillar_id,
        distribution: seed.distribution ?? ['linkedin'],
        brand_fit_score: seed.brand_fit_score,
        confidence: seed.confidence,
        quality_score: seed.quality_score,
        temporal_class: seed.temporal_class,
        expires_in_days: seed.expires_in_days,
        source_label: seed.source_label,
        source_url: url,
        source_excerpt: String(seed.source_excerpt || '').slice(0, MAX_EXCERPT),
        source_ref: runRef,
        evidence_present: seed.evidence_present,
        image_source: seed.image_source ?? null,
        poster_name: seed.poster_name ?? null,
        poster_handle: seed.poster_handle ?? null,
        drive_file_id: file?.candidate.id ?? null,
      },
    })
    const action = (rpc as { action?: string } | null)?.action
    const ideaId = (rpc as { id?: string } | null)?.id || null
    if (action === 'inserted') inserted++
    else if (action === 'recurrence') recurrence++

    if (file) await writeArtifact(file, seed, url, model, ideaId)

    // The creator join. A screenshot of a curated creator's post is the same
    // event the Tuesday scout would have found, so it counts on the same
    // register rather than in a second private tally.
    const handle = handleKey(seed.poster_handle) || handleKey(seed.poster_name)
    if (handle) {
      const match = creators.find(c => creatorMatches(c, seed))
      if (match) {
        await supabase.from('content_creators')
          .update({ posts_seen: (match.posts_seen || 0) + 1, last_post_url: url, last_post_at: new Date().toISOString() })
          .eq('id', match.id)
        creatorHits.push(match.name)

        // The same record the Tuesday scout writes, keyed by the post. If the
        // scout already found this post, the upsert lands on its row and Krish
        // saving a screenshot of it is one move rather than a second idea.
        const excerpt = String(seed.source_excerpt || '').slice(0, MAX_EXCERPT)
        const lift = verbatimCheck(`${seed.idea} ${seed.thesis}`, excerpt)
        if (!lift.ok) verbatimRejects++
        await supabase.from('creator_moves').upsert({
          creator_id: match.id,
          creator_slug: match.slug || handleKey(match.linkedin_slug) || handle,
          post_url: url,
          post_hash: postHash(excerpt),
          move: {},
          krish_angle: lift.ok ? String(seed.thesis || '').slice(0, 600) : null,
          excerpt,
          seen_via: 'screenshot',
          content_idea_id: ideaId,
        }, { onConflict: 'post_hash' })
      }
    }
  }

  // Everything that read is now settled. A file that produced no seed is still
  // read: re-sending it tomorrow buys nothing and costs a vision call.
  for (const c of readOk) await markLedger(c, null, 0, runRef)

  return res.status(200).json({
    ok: true,
    listed,
    unreadable,
    seen_before: selection.seen_before,
    selected: selection.selected.length,
    deferred: selection.deferred.length,
    deferred_files: selection.deferred.map(d => d.name),
    download_failed: downloadFailed,
    read: readOk.length,
    seeds_returned: raw_count,
    survivors: survivors.length,
    rejected,
    rejected_reasons: reasons,
    inserted,
    recurrence,
    creator_matches: creatorHits,
    verbatim_rejects: verbatimRejects,
  })
}

export default withContentRun('inspiration_scan', handler)
