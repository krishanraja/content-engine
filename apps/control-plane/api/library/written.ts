import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardVideoStudioRunner, videoStudioRunnerIdentity } from '../_videoStudioAuth.js'
import { supabase } from '../_supabase.js'
import { VIDEO_STUDIO_CONTROL_SCHEMA_VERSION, sendVideoStudioError } from '../video-studio/_contracts.js'
import { enforceVideoStudioRateLimit } from '../video-studio/_data.js'
import { parseLibraryWrittenRequest } from './_library.js'

// POST /api/library/written, on the runner bearer.
//
//   { schema_version: 1, machine, items: [{ path, sha256, written_as? }] }
//
// Krish's machine says which files it has written into the library folder,
// with the sha256 it checked. `written_as` is the name it used when it kept a
// file Krish had changed and put the new one beside it, in the same folder.
// Recording the same file again moves its time forward and changes nothing
// else. A path and sha256 the library does not hold as ready comes back in
// `unknown`.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardVideoStudioRunner(req, res, ['POST'])) return
  const body = parseLibraryWrittenRequest(req.body)
  if (!body) return sendVideoStudioError(res, 400, 'invalid_library_written_request')
  const machineHash = videoStudioRunnerIdentity(body.machine)
  if (await enforceVideoStudioRateLimit(res, 'library:written', machineHash, 120, 60)) return

  const { data, error } = await supabase.rpc('content_library_record_written', {
    p_machine_hash: machineHash,
    p_items: body.items,
  })
  if (error || !Array.isArray(data)) return sendVideoStudioError(res, 503, 'library_index_unavailable')
  let recorded = 0
  const unknown: Array<{ path: string; sha256: string }> = []
  for (const row of data as Array<Record<string, unknown>>) {
    if (row?.outcome === 'recorded') recorded += 1
    else unknown.push({ path: String(row?.item_path ?? ''), sha256: String(row?.item_sha256 ?? '') })
  }
  return res.status(200).json({
    ok: true,
    schema_version: VIDEO_STUDIO_CONTROL_SCHEMA_VERSION,
    machine: machineHash.slice(0, 8),
    recorded,
    unknown,
  })
}
