import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardCronRoute } from '../../_auth.js'
import { loadConfig } from '../../_content.js'
import { googleConfigured } from '../../_google.js'
import { withContentRun } from '../../_runs.js'
import { supabase } from '../../_supabase.js'
import { isSignedPreviewUrlAllowed } from '../../video-studio/_previewStorage.js'
import { INBOX_FOLDER_ID, INBOX_RUN_BUDGET_MS, copyDriveFile, copyFits, decideRecording, listInbox, planInbox, type InboxSkip } from '../_inboxDrive.js'
import { lanePlainProblems, readLaneReports } from '../_lanes.js'
import { dispatchPlaceTakes } from '../_placeTakes.js'
import { configuredLibraryStore, verifyStoredLibraryObject } from '../_library.js'
import { readRecordingManifest, recordingObjectKey, withName, writeRecordingManifest } from '../_recordings.js'

// The Inbox job, recorded in the run ledger as recordings_drive_inbox.
//
//   GET  /api/library/recordings/drive-inbox   cron, every ten minutes
//   POST /api/library/recordings/drive-inbox   by hand, on the cron secret or the engine key
//
// Lists the Video Engine Inbox by its Drive folder ID and copies each new
// recording into the recordings store (api/library/_inboxDrive.ts says why).
// The home computers' upload keeps running beside it until this has carried a
// real take end to end; both key the bytes by sha256, so the two never make
// two copies.
//
// Once a take is copied (or new bytes are named), it asks GitHub to place
// the new takes on their pieces (api/library/_placeTakes.ts, place-takes.yml);
// the answer's place_takes says whether that was sent.
//
// It fails, so Control Center shows it, when the Inbox cannot be read by its
// ID, when a recording could not be copied, and while a home computer's last
// pass reported a problem (api/library/_lanes.ts).

async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardCronRoute(req, res)) return
  const started = Date.now()

  if (!googleConfigured()) {
    return res.status(200).json({ ok: false, error: 'the engine has no Google service account (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY), so it cannot read the Inbox by its ID' })
  }
  const store = await configuredLibraryStore()
  if (!store.config) return res.status(200).json({ ok: false, error: store.error || 'library_store_unavailable' })
  const bucket = store.config.bucket

  const cfg = await loadConfig(['recordings_inbox_folder_id'])
  const folderId = String(cfg.recordings_inbox_folder_id || '').trim() || INBOX_FOLDER_ID

  // The home computers first: their problems are reported whatever Drive says.
  const lanes = await readLaneReports(bucket)
  const machineProblems = lanePlainProblems(lanes.reports, started)

  const listing = await listInbox(folderId)
  if (listing.ok === false) {
    return res.status(200).json({
      ok: false,
      error: `the Video Engine Inbox cannot be read by its ID: ${listing.reason}. ${listing.fix}${machineProblems.length ? ` Also: ${machineProblems.join('; ')}.` : ''}`,
      machine_problems: machineProblems.length,
    })
  }

  const skipped: Record<InboxSkip, number> = { not_recording: 0, too_large: 0, no_checksum: 0, settling: 0 }
  let copied = 0
  let named = 0
  let already = 0
  let deferred = 0
  const failures: string[] = []

  for (const step of planInbox(listing.files, started)) {
    if (step.kind === 'skip') { skipped[step.why]++; continue }
    const { request, file } = step
    const name = request.recording.name
    try {
      const found = await readRecordingManifest(bucket, request.sha256)
      if (found.error) throw new Error('the store could not be read')
      const objectKey = recordingObjectKey(request.sha256, request.recording.extension)
      if (found.manifest && found.manifest.object_key !== objectKey) throw new Error('the store holds these bytes under another type')
      const action = found.manifest && found.manifest.names.includes(name)
        ? 'already_listed'
        : await (async () => {
          const stored = await verifyStoredLibraryObject(bucket, objectKey, request.bytes, request.recording.contentType, request.md5)
          if (stored === 'mismatch') throw new Error('the store holds different bytes under this sha256')
          if (stored === 'unavailable') throw new Error('the store could not be read')
          return decideRecording(request, found.manifest, stored)
        })()
      if (action === 'already_listed') { already++; continue }
      if (action === 'copy') {
        if (!copyFits(request.bytes, Date.now() - started)) { deferred++; continue }
        if (!store.config.allowedTypes.includes(request.recording.contentType)) throw new Error(`the bucket does not take ${request.recording.contentType} yet`)
        const signed = await supabase.storage.from(bucket).createSignedUploadUrl(objectKey, { upsert: false })
        if (signed.error || !signed.data?.signedUrl || !isSignedPreviewUrlAllowed(signed.data.signedUrl, store.config.supabaseOrigin)) {
          throw new Error('the store gave no upload address')
        }
        const sent = await copyDriveFile(file.id, signed.data.signedUrl, request.recording.contentType, request.bytes, INBOX_RUN_BUDGET_MS - (Date.now() - started))
        // 400 or 409: the bytes arrived meanwhile, most likely from a home
        // computer; the check below proves them either way.
        if ((sent.status < 200 || sent.status >= 300) && sent.status !== 400 && sent.status !== 409) throw new Error(`the upload answered ${sent.status}`)
        if (sent.status >= 200 && sent.status < 300 && sent.sha256 !== request.sha256) {
          const removed = await supabase.storage.from(bucket).remove([objectKey])
          throw new Error(removed.error
            ? `the bytes read from Drive did not match the sha256 Drive reported, and removing them failed: ${objectKey} needs removing by hand`
            : 'the bytes read from Drive did not match the sha256 Drive reported; removed, tried again next run')
        }
        const stored = await verifyStoredLibraryObject(bucket, objectKey, request.bytes, request.recording.contentType, request.md5)
        if (stored !== 'verified') throw new Error(`the stored copy did not check (${stored})`)
      }
      const manifest = withName(found.manifest, request, new Date().toISOString())
      if (!(await writeRecordingManifest(bucket, manifest))) throw new Error('the manifest could not be written')
      if (action === 'copy') copied++
      else named++
    } catch (error) {
      failures.push(`${name}: ${(error as Error)?.message || 'failed'}`)
    }
  }

  const placeTakes = await dispatchPlaceTakes(copied + named)
  const counts = {
    place_takes: placeTakes.sent === true ? 'sent' : placeTakes.reason,
    listed: listing.files.length,
    copied,
    named,
    already_there: already,
    deferred,
    failed: failures.length,
    not_recording: skipped.not_recording,
    too_large: skipped.too_large,
    no_checksum: skipped.no_checksum,
    settling: skipped.settling,
    machine_problems: machineProblems.length,
  }
  const problems = [
    ...(failures.length ? [`${failures.length} recording(s) could not be copied from the Inbox (${failures.slice(0, 3).join('; ')})`] : []),
    ...(listing.truncated ? ['the Inbox holds more files than one run lists; the oldest were not looked at'] : []),
    ...(skipped.too_large ? [`${skipped.too_large} recording(s) in the Inbox are over the 2 GiB the engine takes`] : []),
    ...machineProblems,
    ...(lanes.error ? ['the home computers\' reports could not be read'] : []),
  ]
  if (problems.length) return res.status(200).json({ ok: false, error: problems.join('. '), ...counts })
  return res.status(200).json({ ok: true, folder: listing.folderName, ...counts })
}

export default withContentRun('recordings_drive_inbox', handler)
