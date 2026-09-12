import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  guardVideoStudioRunner,
  rejectVideoStudioRunnerReceipt,
  verifyVideoStudioRunnerReceipt,
} from '../../_videoStudioAuth.js'
import {
  VIDEO_STUDIO_CONTROL_SCHEMA_VERSION,
  sendVideoStudioError,
} from '../_contracts.js'

const LOWER_SHA256 = /^[a-f0-9]{64}$/

interface RunnerCredentialProbeV1 {
  schema_version: 1
  challenge_hash: string
  challenge_signature: string
}

function parseProbe(value: unknown): RunnerCredentialProbeV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (Object.keys(record).sort().join(',') !== 'challenge_hash,challenge_signature,schema_version') return null
  if (record.schema_version !== VIDEO_STUDIO_CONTROL_SCHEMA_VERSION) return null
  if (typeof record.challenge_hash !== 'string' || !LOWER_SHA256.test(record.challenge_hash)) return null
  if (typeof record.challenge_signature !== 'string' || !LOWER_SHA256.test(record.challenge_signature)) return null
  return record as unknown as RunnerCredentialProbeV1
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (guardVideoStudioRunner(req, res, ['POST'])) return
  const body = parseProbe(req.body)
  if (!body) return sendVideoStudioError(res, 400, 'invalid_credential_probe')

  const signing = verifyVideoStudioRunnerReceipt(body.challenge_hash, body.challenge_signature)
  if (signing !== 'valid') return rejectVideoStudioRunnerReceipt(res, signing)

  return res.status(200).json({
    ok: true,
    schema_version: VIDEO_STUDIO_CONTROL_SCHEMA_VERSION,
    bearer: 'accepted',
    signing: 'accepted',
  })
}
