import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { hashFile } from './hash.js'
import { MEDIA_STANDARD_HASH, MediaBriefSchema, MediaRefSchema, briefProblems, canonicalMediaJson, mediaDigest } from './media-quality.js'

const Request = z.object({ piece_id: z.string().min(1), production_id: z.string().min(1), role: z.enum(['video', 'slide', 'document', 'manifest']), artifact: MediaRefSchema, receipt: MediaRefSchema, cut: z.enum(['short', 'long', 'feature']).optional() }).strict()
/** Only the server's current key registry can qualify delivery. A local JSON pass
 * or an environment variable containing a producer's own public key cannot. */
export async function assertQualifiedFile(path: string, expectedPiece?: string, expectedJob?: string, expectedRole?: z.infer<typeof Request>['role']) {
  let request: z.infer<typeof Request>
  try { request = Request.parse(JSON.parse(await readFile(`${path}.media-quality.json`, 'utf8'))) }
  catch { throw new Error('independent media quality binding missing; create a working candidate and submit it for review') }
  if (await hashFile(path) !== request.artifact.sha256) throw new Error('media bytes changed after review')
  if (expectedPiece && request.piece_id !== expectedPiece) throw new Error('media qualification belongs to another piece')
  if (expectedJob && request.production_id !== expectedJob) throw new Error('media qualification belongs to another production job')
  if (expectedRole && request.role !== expectedRole) throw new Error('media qualification has the wrong artifact role')
  await verifyRemote(request, 'final')
  return request
}
async function verifyRemote(request: z.infer<typeof Request>, stage: 'proof' | 'final') {
  const token = process.env.ENGINE_OPERATOR_TOKEN
  if (!token) throw new Error('authenticated media qualification service unavailable')
  const response = await fetch('https://content-engine-flame-nu.vercel.app/api/media-quality', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(180000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...request, stage }),
  })
  if (!response.ok) throw new Error(`media delivery is not qualified (HTTP ${response.status})`)
  const result = await response.json() as Record<string, any>
  const q = result.qualification
  if (result.ok !== true || q?.qualified !== true || q.stage !== stage || q.role !== request.role || q.production_id !== request.production_id || q.standard_sha256 !== MEDIA_STANDARD_HASH || q.piece_id !== request.piece_id
    || q.qualification_id !== request.receipt.sha256 || q.artifact?.sha256 !== request.artifact.sha256 || q.artifact?.path !== request.artifact.path) throw new Error('media qualification readback mismatch')
  return q
}

export async function assertProductionBrief(path: string, fullProduction: boolean, expectedJob?: string) {
  let brief: z.infer<typeof MediaBriefSchema>
  try { brief = MediaBriefSchema.parse(JSON.parse(await readFile(path, 'utf8'))) }
  catch { throw new Error(`Current-piece media brief required at ${path}; read docs/MEDIA_STANDARD.md`) }
  const problems = briefProblems(brief)
  if (expectedJob && brief.production_id !== expectedJob) problems.push('media brief belongs to another production job')
  if (problems.length) throw new Error(problems.join('; '))
  if (fullProduction) {
    let request: z.infer<typeof Request>
    try { request = Request.parse(JSON.parse(await readFile(`${path}.proof-quality.json`, 'utf8'))) }
    catch { throw new Error('Representative proof must qualify before full production') }
    if (request.piece_id !== brief.piece_id) throw new Error('Representative proof belongs to another piece')
    const q = await verifyRemote(request, 'proof')
    if (q.brief_sha256 !== mediaDigest(canonicalMediaJson(brief))) throw new Error('Creative brief changed after representative proof')
  }
  return brief
}
