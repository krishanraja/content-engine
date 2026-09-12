import { createHash, randomBytes } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadRunnerReceiptSigningKey,
  signRunnerReceiptHash,
} from '../packages/core/src/approval-signing.js'
import { CONTROL_CENTER_RUNNER_CREDENTIAL } from '../packages/core/src/control-plane-client.js'
import { readWindowsCredential } from '../packages/core/src/credentials.js'

const ENDPOINT = 'https://controlcenter.krishraja.com/api/video-studio/runner/credential-probe'
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function main(): Promise<void> {
  if (process.platform !== 'win32') throw new Error('The runner credential probe must run on the Windows runner host.')

  const [bearer, signingKey] = await Promise.all([
    readWindowsCredential(REPO_ROOT, CONTROL_CENTER_RUNNER_CREDENTIAL),
    loadRunnerReceiptSigningKey(),
  ])
  if (Buffer.byteLength(bearer, 'utf8') < 32) throw new Error('The active runner bearer is unavailable.')
  if (!signingKey) throw new Error('The active runner signing credential is unavailable.')

  const challengeHash = createHash('sha256').update(randomBytes(32)).digest('hex')
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${bearer}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      schema_version: 1,
      challenge_hash: challengeHash,
      challenge_signature: signRunnerReceiptHash(signingKey, challengeHash),
    }),
  })

  const body = await response.json().catch(() => null) as {
    ok?: unknown
    schema_version?: unknown
    bearer?: unknown
    signing?: unknown
    error?: { code?: unknown }
  } | null
  if (
    response.status !== 200
    || body?.ok !== true
    || body.schema_version !== 1
    || body.bearer !== 'accepted'
    || body.signing !== 'accepted'
  ) {
    const rawCode = body?.error?.code
    const safeCode = typeof rawCode === 'string' && /^[a-z0-9_]{1,80}$/.test(rawCode)
      ? rawCode
      : `http_${response.status}`
    throw new Error(`Runner credential probe failed: ${safeCode}`)
  }

  process.stdout.write('runner bearer and signing credentials accepted by production\n')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Runner credential probe failed.')
  process.exit(1)
})
