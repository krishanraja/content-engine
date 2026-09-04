import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { hashFile, hashValue, stableJson } from './hash.js'
import { resolvePythonCommand } from './python-runtime.js'
import { run } from './process.js'
import { studioPaths } from './paths.js'

export const KRISH_IDENTITY_CREDENTIAL = 'MindmakeVideoStudio/krish-identity-key'
export const KRISH_IDENTITY_PROFILE_ID = 'krish-face-v1'

export interface KrishFaceIdentityProfileV1 {
  schema_version: 1
  profile_id: typeof KRISH_IDENTITY_PROFILE_ID
  display_name: 'Krish'
  model: 'opencv-dct-face-v1'
  created_at: string
  source_hashes: string[]
  sample_count: number
  descriptors: number[][]
  match_threshold: number
  minimum_margin: number
}

interface EncryptedIdentityEnvelopeV1 {
  schema_version: 1
  algorithm: 'aes-256-gcm+scrypt'
  profile_id: typeof KRISH_IDENTITY_PROFILE_ID
  profile_version_hash: string
  iv: string
  authentication_tag: string
  ciphertext: string
}

interface ExtractedFaceTemplate {
  model: 'opencv-dct-face-v1'
  sample_count: number
  descriptors: number[][]
}

export interface IdentityProfileReference {
  profile_id: typeof KRISH_IDENTITY_PROFILE_ID
  version_hash: string
  display_name: 'Krish'
}

function identityDirectory(runtimeRoot = studioPaths().runtimeRoot): string {
  return join(runtimeRoot, 'identity')
}

export function krishIdentityPath(runtimeRoot = studioPaths().runtimeRoot): string {
  return join(identityDirectory(runtimeRoot), `${KRISH_IDENTITY_PROFILE_ID}.enc.json`)
}

function encryptionKey(secret: string): Buffer {
  if (secret.length < 32) throw new Error(`${KRISH_IDENTITY_CREDENTIAL} must contain at least 32 characters of random material`)
  return scryptSync(secret, 'MindmakeVideoStudio/KrishIdentity/v1', 32)
}

function validateTemplate(value: unknown): ExtractedFaceTemplate {
  if (!value || typeof value !== 'object') throw new Error('face template extractor returned an invalid payload')
  const candidate = value as Partial<ExtractedFaceTemplate>
  if (candidate.model !== 'opencv-dct-face-v1') throw new Error('unsupported face identity model')
  if (!Number.isInteger(candidate.sample_count) || (candidate.sample_count ?? 0) < 5) throw new Error('identity enrollment requires at least five clear face samples')
  if (!Array.isArray(candidate.descriptors) || candidate.descriptors.length < 5) throw new Error('identity enrollment did not return enough descriptors')
  const descriptorLength = candidate.descriptors[0]?.length ?? 0
  if (descriptorLength < 32 || candidate.descriptors.some((descriptor) => !Array.isArray(descriptor) || descriptor.length !== descriptorLength || descriptor.some((entry) => !Number.isFinite(entry)))) {
    throw new Error('identity enrollment returned malformed descriptors')
  }
  return candidate as ExtractedFaceTemplate
}

function validateProfile(value: unknown): KrishFaceIdentityProfileV1 {
  if (!value || typeof value !== 'object') throw new Error('decrypted identity profile is invalid')
  const profile = value as Partial<KrishFaceIdentityProfileV1>
  if (profile.schema_version !== 1 || profile.profile_id !== KRISH_IDENTITY_PROFILE_ID || profile.display_name !== 'Krish' || profile.model !== 'opencv-dct-face-v1') throw new Error('decrypted identity profile has an unsupported identity or version')
  validateTemplate(profile)
  if (!Array.isArray(profile.source_hashes) || !profile.source_hashes.length || profile.source_hashes.some((hash) => !/^[a-f0-9]{64}$/.test(hash))) throw new Error('decrypted identity profile has invalid provenance')
  if (typeof profile.match_threshold !== 'number' || typeof profile.minimum_margin !== 'number') throw new Error('decrypted identity profile has invalid matching policy')
  return profile as KrishFaceIdentityProfileV1
}

export function encryptKrishIdentity(profile: KrishFaceIdentityProfileV1, secret: string): EncryptedIdentityEnvelopeV1 {
  const validated = validateProfile(profile)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv)
  cipher.setAAD(Buffer.from(`${KRISH_IDENTITY_PROFILE_ID}:v1`, 'utf8'))
  const ciphertext = Buffer.concat([cipher.update(stableJson(validated), 'utf8'), cipher.final()])
  return {
    schema_version: 1,
    algorithm: 'aes-256-gcm+scrypt',
    profile_id: KRISH_IDENTITY_PROFILE_ID,
    profile_version_hash: hashValue(validated),
    iv: iv.toString('base64'),
    authentication_tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  }
}

export function decryptKrishIdentity(envelope: EncryptedIdentityEnvelopeV1, secret: string): KrishFaceIdentityProfileV1 {
  if (envelope.schema_version !== 1 || envelope.algorithm !== 'aes-256-gcm+scrypt' || envelope.profile_id !== KRISH_IDENTITY_PROFILE_ID) throw new Error('unsupported encrypted identity profile')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), Buffer.from(envelope.iv, 'base64'))
  decipher.setAAD(Buffer.from(`${KRISH_IDENTITY_PROFILE_ID}:v1`, 'utf8'))
  decipher.setAuthTag(Buffer.from(envelope.authentication_tag, 'base64'))
  const cleartext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8')
  const profile = validateProfile(JSON.parse(cleartext))
  if (hashValue(profile) !== envelope.profile_version_hash) throw new Error('identity profile integrity check failed')
  return profile
}

export async function enrollKrishIdentity(
  repoRoot: string,
  sources: string[],
  secret: string,
  createdAt: string,
  runtimeRoot = studioPaths().runtimeRoot,
): Promise<IdentityProfileReference> {
  if (sources.length < 1 || sources.length > 12) throw new Error('provide between one and twelve Krish-only enrollment sources')
  const paths = sources.map((source) => resolve(source))
  await Promise.all(paths.map((path) => access(path)))
  const python = await resolvePythonCommand(repoRoot)
  const { stdout } = await run(python, [join(repoRoot, 'scripts', 'face-identity.py'), 'enroll', ...paths.flatMap((path) => ['--input', path])], { timeoutMs: 3_600_000 })
  const template = validateTemplate(JSON.parse(stdout))
  const profile: KrishFaceIdentityProfileV1 = {
    schema_version: 1,
    profile_id: KRISH_IDENTITY_PROFILE_ID,
    display_name: 'Krish',
    model: template.model,
    created_at: createdAt,
    source_hashes: await Promise.all(paths.map(hashFile)),
    sample_count: template.sample_count,
    descriptors: template.descriptors,
    match_threshold: 0.62,
    minimum_margin: 0.045,
  }
  const envelope = encryptKrishIdentity(profile, secret)
  await mkdir(identityDirectory(runtimeRoot), { recursive: true })
  await writeFile(krishIdentityPath(runtimeRoot), `${JSON.stringify(envelope)}\n`, { encoding: 'utf8', mode: 0o600 })
  return { profile_id: KRISH_IDENTITY_PROFILE_ID, version_hash: envelope.profile_version_hash, display_name: 'Krish' }
}

export async function loadKrishIdentity(secret: string, runtimeRoot = studioPaths().runtimeRoot): Promise<{ reference: IdentityProfileReference; profile: KrishFaceIdentityProfileV1 }> {
  const envelope = JSON.parse(await readFile(krishIdentityPath(runtimeRoot), 'utf8')) as EncryptedIdentityEnvelopeV1
  const profile = decryptKrishIdentity(envelope, secret)
  return {
    reference: { profile_id: KRISH_IDENTITY_PROFILE_ID, version_hash: envelope.profile_version_hash, display_name: 'Krish' },
    profile,
  }
}

export async function krishIdentityStatus(runtimeRoot = studioPaths().runtimeRoot): Promise<{ enrolled: boolean; profile_id?: string; version_hash?: string }> {
  try {
    const envelope = JSON.parse(await readFile(krishIdentityPath(runtimeRoot), 'utf8')) as Partial<EncryptedIdentityEnvelopeV1>
    if (envelope.profile_id !== KRISH_IDENTITY_PROFILE_ID || !envelope.profile_version_hash) return { enrolled: false }
    return { enrolled: true, profile_id: envelope.profile_id, version_hash: envelope.profile_version_hash }
  } catch {
    return { enrolled: false }
  }
}

export async function revokeKrishIdentity(runtimeRoot = studioPaths().runtimeRoot): Promise<void> {
  await rm(krishIdentityPath(runtimeRoot), { force: true })
}
