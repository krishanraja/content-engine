import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  decryptKrishIdentity,
  encryptKrishIdentity,
  krishIdentityPath,
  krishIdentityStatus,
  loadKrishIdentity,
  revokeKrishIdentity,
  type KrishFaceIdentityProfileV1,
} from '@mindmake/core'

const secret = 'test-only-identity-key-material-1234567890'
const descriptor = Array.from({ length: 32 }, (_, index) => Number(((index + 1) / 100).toFixed(4)))
const profile: KrishFaceIdentityProfileV1 = {
  schema_version: 1,
  profile_id: 'krish-face-v1',
  display_name: 'Krish',
  model: 'opencv-dct-face-v1',
  created_at: '2026-09-04T10:00:00.000Z',
  source_hashes: ['a'.repeat(64)],
  sample_count: 5,
  descriptors: Array.from({ length: 5 }, () => [...descriptor]),
  match_threshold: 0.62,
  minimum_margin: 0.045,
}

describe('Krish-only identity profile', () => {
  it('encrypts the face template and detects an incorrect credential', () => {
    const envelope = encryptKrishIdentity(profile, secret)
    expect(JSON.stringify(envelope)).not.toContain('descriptors')
    expect(decryptKrishIdentity(envelope, secret)).toEqual(profile)
    expect(() => decryptKrishIdentity(envelope, `${secret}-wrong`)).toThrow()
  })

  it('reports, loads and revokes only the fixed Krish profile', async () => {
    const runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-identity-'))
    const path = krishIdentityPath(runtimeRoot)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(encryptKrishIdentity(profile, secret)), 'utf8')

    expect(await krishIdentityStatus(runtimeRoot)).toMatchObject({ enrolled: true, profile_id: 'krish-face-v1' })
    expect((await loadKrishIdentity(secret, runtimeRoot)).profile.display_name).toBe('Krish')
    await revokeKrishIdentity(runtimeRoot)
    expect(await krishIdentityStatus(runtimeRoot)).toEqual({ enrolled: false })
  })
})
